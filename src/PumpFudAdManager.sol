// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PumpFudAdManager
 * @notice Advertisement management for pump.fud platform
 * @dev Manages ad carousel and rentable ad spaces across all UIs
 *
 * AD LOCATIONS:
 * - Landing page carousel
 * - Token dashboard sidebars
 * - Token list banners
 * - Launch page spots
 * - Footer banners
 *
 * PRICING:
 * - Default: 25,000 PLS per ad space per week
 * - Owner ads: FREE (platform promotion)
 * - All adjustable via admin functions
 *
 * FUTURE INTEGRATION:
 * - TOKEN PULSE (Dexscreener clone) integration
 * - Graduated tokens get customizable UI on TOKEN PULSE
 * - wFUD platform token rewards
 */
contract PumpFudAdManager is ReentrancyGuard, Ownable {
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // Default pricing (adjustable)
    uint256 public weeklyRatePLS = 25_000 ether; // 25,000 PLS per week
    uint256 public constant WEEK = 7 days;

    // Ad space types
    enum AdLocation {
        LandingCarousel,      // Main landing page carousel
        LandingBanner,        // Landing page top banner
        DashboardSidebar,     // Token dashboard sidebar
        DashboardBanner,      // Token dashboard top banner
        TokenListBanner,      // Token list page banner
        LaunchPageSpot,       // Launch page promotional spot
        FooterBanner,         // Footer across all pages
        CarouselAllPages      // Rotating carousel on all pages
    }

    struct AdSpace {
        uint256 id;
        AdLocation location;
        string name;              // "Landing Carousel Slot 1"
        uint256 weeklyRate;       // PLS per week (0 = use default)
        bool isActive;            // Space available for rent
        bool isPremium;           // Premium spots cost more
        uint256 premiumMultiplier; // 100 = 1x, 200 = 2x, etc.
    }

    struct Ad {
        uint256 id;
        uint256 spaceId;          // Which ad space
        address advertiser;       // Who placed it
        string imageUri;          // IPFS or URL to ad image
        string linkUrl;           // Click destination
        string altText;           // Accessibility text
        uint256 startTime;
        uint256 endTime;
        uint256 paidAmount;       // How much was paid
        bool isOwnerAd;           // Owner ads are free
        bool isActive;
    }

    struct AdStats {
        uint256 impressions;
        uint256 clicks;
        uint256 lastUpdated;
    }

    // State
    uint256 public adSpaceCount;
    uint256 public adCount;

    mapping(uint256 => AdSpace) public adSpaces;
    mapping(uint256 => Ad) public ads;
    mapping(uint256 => AdStats) public adStats; // adId => stats
    mapping(uint256 => uint256) public currentAd; // spaceId => current adId
    mapping(uint256 => uint256[]) public spaceAdHistory; // spaceId => adIds
    mapping(AdLocation => uint256[]) public locationSpaces; // location => spaceIds

    // Carousel state
    mapping(AdLocation => uint256[]) public carouselAds; // location => active adIds for carousel
    mapping(AdLocation => uint256) public carouselIndex; // location => current index

    // Events
    event AdSpaceCreated(uint256 indexed spaceId, AdLocation location, string name, uint256 weeklyRate);
    event AdSpaceUpdated(uint256 indexed spaceId, uint256 weeklyRate, bool isActive);
    event AdPlaced(uint256 indexed adId, uint256 indexed spaceId, address indexed advertiser, uint256 duration, uint256 paid);
    event OwnerAdPlaced(uint256 indexed adId, uint256 indexed spaceId, string imageUri);
    event AdRemoved(uint256 indexed adId, uint256 indexed spaceId);
    event AdClicked(uint256 indexed adId, uint256 timestamp);
    event AdImpression(uint256 indexed adId, uint256 count, uint256 timestamp);
    event WeeklyRateUpdated(uint256 oldRate, uint256 newRate);

    // Errors
    error AdSpaceNotFound();
    error AdSpaceNotActive();
    error AdNotFound();
    error InsufficientPayment();
    error AdSpaceOccupied();
    error NotAdvertiser();
    error AdExpired();
    error InvalidDuration();

    constructor() Ownable(msg.sender) {
        _initializeDefaultSpaces();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZE DEFAULT AD SPACES
    // ═══════════════════════════════════════════════════════════════════════════

    function _initializeDefaultSpaces() internal {
        // Landing page carousel (5 slots)
        for (uint256 i = 1; i <= 5; i++) {
            _createAdSpace(AdLocation.LandingCarousel, string.concat("Landing Carousel Slot ", _toString(i)), 0, true, 150);
        }

        // Landing banner (premium)
        _createAdSpace(AdLocation.LandingBanner, "Landing Page Top Banner", 0, true, 200);

        // Dashboard sidebars (10 slots for different dashboards)
        for (uint256 i = 1; i <= 10; i++) {
            _createAdSpace(AdLocation.DashboardSidebar, string.concat("Dashboard Sidebar ", _toString(i)), 0, false, 100);
        }

        // Token list banner
        _createAdSpace(AdLocation.TokenListBanner, "Token List Banner", 0, true, 150);

        // Launch page spots (3 slots)
        for (uint256 i = 1; i <= 3; i++) {
            _createAdSpace(AdLocation.LaunchPageSpot, string.concat("Launch Page Spot ", _toString(i)), 0, true, 175);
        }

        // Footer banners (3 slots)
        for (uint256 i = 1; i <= 3; i++) {
            _createAdSpace(AdLocation.FooterBanner, string.concat("Footer Banner ", _toString(i)), 0, false, 100);
        }

        // All-pages carousel (5 slots - appears on every page)
        for (uint256 i = 1; i <= 5; i++) {
            _createAdSpace(AdLocation.CarouselAllPages, string.concat("Global Carousel Slot ", _toString(i)), 0, true, 250);
        }
    }

    function _createAdSpace(
        AdLocation location,
        string memory name,
        uint256 customRate,
        bool isPremium,
        uint256 premiumMultiplier
    ) internal returns (uint256 spaceId) {
        adSpaceCount++;
        spaceId = adSpaceCount;

        adSpaces[spaceId] = AdSpace({
            id: spaceId,
            location: location,
            name: name,
            weeklyRate: customRate,
            isActive: true,
            isPremium: isPremium,
            premiumMultiplier: premiumMultiplier
        });

        locationSpaces[location].push(spaceId);

        emit AdSpaceCreated(spaceId, location, name, customRate);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER: PLACE FREE ADS (Platform Promotion)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Owner places free ad (platform promotion)
     * @param spaceId Ad space to use
     * @param imageUri IPFS or URL to ad image
     * @param linkUrl Click destination
     * @param altText Accessibility text
     * @param durationWeeks How many weeks (0 = permanent until removed)
     */
    function placeOwnerAd(
        uint256 spaceId,
        string calldata imageUri,
        string calldata linkUrl,
        string calldata altText,
        uint256 durationWeeks
    ) external onlyOwner returns (uint256 adId) {
        AdSpace storage space = adSpaces[spaceId];
        if (space.id == 0) revert AdSpaceNotFound();

        adCount++;
        adId = adCount;

        uint256 endTime = durationWeeks == 0 ? type(uint256).max : block.timestamp + (durationWeeks * WEEK);

        ads[adId] = Ad({
            id: adId,
            spaceId: spaceId,
            advertiser: msg.sender,
            imageUri: imageUri,
            linkUrl: linkUrl,
            altText: altText,
            startTime: block.timestamp,
            endTime: endTime,
            paidAmount: 0,
            isOwnerAd: true,
            isActive: true
        });

        currentAd[spaceId] = adId;
        spaceAdHistory[spaceId].push(adId);
        _addToCarousel(space.location, adId);

        emit OwnerAdPlaced(adId, spaceId, imageUri);
    }

    /**
     * @notice Owner removes any ad
     */
    function removeAd(uint256 adId) external onlyOwner {
        Ad storage ad = ads[adId];
        if (ad.id == 0) revert AdNotFound();

        ad.isActive = false;
        if (currentAd[ad.spaceId] == adId) {
            currentAd[ad.spaceId] = 0;
        }
        _removeFromCarousel(adSpaces[ad.spaceId].location, adId);

        emit AdRemoved(adId, ad.spaceId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC: RENT AD SPACE (Paid)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Rent an ad space with PLS
     * @param spaceId Ad space to rent
     * @param imageUri IPFS or URL to ad image
     * @param linkUrl Click destination
     * @param altText Accessibility text
     * @param durationWeeks Number of weeks to rent
     */
    function rentAdSpace(
        uint256 spaceId,
        string calldata imageUri,
        string calldata linkUrl,
        string calldata altText,
        uint256 durationWeeks
    ) external payable nonReentrant returns (uint256 adId) {
        if (durationWeeks == 0) revert InvalidDuration();

        AdSpace storage space = adSpaces[spaceId];
        if (space.id == 0) revert AdSpaceNotFound();
        if (!space.isActive) revert AdSpaceNotActive();

        // Check if space is currently occupied
        uint256 existingAdId = currentAd[spaceId];
        if (existingAdId != 0) {
            Ad storage existingAd = ads[existingAdId];
            if (existingAd.isActive && existingAd.endTime > block.timestamp) {
                revert AdSpaceOccupied();
            }
        }

        // Calculate cost
        uint256 cost = calculateRentalCost(spaceId, durationWeeks);
        if (msg.value < cost) revert InsufficientPayment();

        // Create ad
        adCount++;
        adId = adCount;

        ads[adId] = Ad({
            id: adId,
            spaceId: spaceId,
            advertiser: msg.sender,
            imageUri: imageUri,
            linkUrl: linkUrl,
            altText: altText,
            startTime: block.timestamp,
            endTime: block.timestamp + (durationWeeks * WEEK),
            paidAmount: msg.value,
            isOwnerAd: false,
            isActive: true
        });

        currentAd[spaceId] = adId;
        spaceAdHistory[spaceId].push(adId);
        _addToCarousel(space.location, adId);

        // Send cost to treasury
        (bool sent,) = TREASURY.call{value: cost}("");
        require(sent, "Payment failed");

        // Refund excess
        if (msg.value > cost) {
            (sent,) = msg.sender.call{value: msg.value - cost}("");
            require(sent, "Refund failed");
        }

        emit AdPlaced(adId, spaceId, msg.sender, durationWeeks, cost);
    }

    /**
     * @notice Extend an existing ad rental
     */
    function extendAdRental(uint256 adId, uint256 additionalWeeks) external payable nonReentrant {
        if (additionalWeeks == 0) revert InvalidDuration();

        Ad storage ad = ads[adId];
        if (ad.id == 0) revert AdNotFound();
        if (ad.advertiser != msg.sender) revert NotAdvertiser();
        if (ad.isOwnerAd) revert NotAdvertiser(); // Owner ads don't need extension

        uint256 cost = calculateRentalCost(ad.spaceId, additionalWeeks);
        if (msg.value < cost) revert InsufficientPayment();

        // Extend from current end time or now, whichever is later
        uint256 startFrom = ad.endTime > block.timestamp ? ad.endTime : block.timestamp;
        ad.endTime = startFrom + (additionalWeeks * WEEK);
        ad.paidAmount += msg.value;

        // Send payment to treasury
        (bool sent,) = TREASURY.call{value: msg.value}("");
        require(sent, "Payment failed");

        emit AdPlaced(adId, ad.spaceId, msg.sender, additionalWeeks, msg.value);
    }

    /**
     * @notice Calculate rental cost for an ad space
     */
    function calculateRentalCost(uint256 spaceId, uint256 weeks_) public view returns (uint256) {
        AdSpace storage space = adSpaces[spaceId];
        if (space.id == 0) revert AdSpaceNotFound();

        uint256 baseRate = space.weeklyRate > 0 ? space.weeklyRate : weeklyRatePLS;
        uint256 multiplier = space.isPremium ? space.premiumMultiplier : 100;

        return (baseRate * multiplier * weeks_) / 100;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CAROUSEL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function _addToCarousel(AdLocation location, uint256 adId) internal {
        carouselAds[location].push(adId);
    }

    function _removeFromCarousel(AdLocation location, uint256 adId) internal {
        uint256[] storage carousel = carouselAds[location];
        for (uint256 i = 0; i < carousel.length; i++) {
            if (carousel[i] == adId) {
                carousel[i] = carousel[carousel.length - 1];
                carousel.pop();
                break;
            }
        }
    }

    /**
     * @notice Get next ad in carousel rotation
     */
    function getNextCarouselAd(AdLocation location) external returns (uint256 adId) {
        uint256[] storage carousel = carouselAds[location];
        if (carousel.length == 0) return 0;

        // Clean expired ads
        _cleanExpiredAds(location);

        if (carousel.length == 0) return 0;

        uint256 index = carouselIndex[location] % carousel.length;
        adId = carousel[index];
        carouselIndex[location] = index + 1;

        // Record impression
        adStats[adId].impressions++;
        adStats[adId].lastUpdated = block.timestamp;

        emit AdImpression(adId, adStats[adId].impressions, block.timestamp);
    }

    function _cleanExpiredAds(AdLocation location) internal {
        uint256[] storage carousel = carouselAds[location];
        uint256 i = 0;
        while (i < carousel.length) {
            Ad storage ad = ads[carousel[i]];
            if (!ad.isActive || (ad.endTime < block.timestamp && ad.endTime != type(uint256).max)) {
                carousel[i] = carousel[carousel.length - 1];
                carousel.pop();
            } else {
                i++;
            }
        }
    }

    /**
     * @notice Record ad click (called by frontend)
     */
    function recordClick(uint256 adId) external {
        Ad storage ad = ads[adId];
        if (ad.id == 0) revert AdNotFound();

        adStats[adId].clicks++;
        adStats[adId].lastUpdated = block.timestamp;

        emit AdClicked(adId, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get all active ads for a location
     */
    function getActiveAdsForLocation(AdLocation location) external view returns (Ad[] memory) {
        uint256[] storage carousel = carouselAds[location];
        uint256 activeCount = 0;

        // Count active
        for (uint256 i = 0; i < carousel.length; i++) {
            Ad storage ad = ads[carousel[i]];
            if (ad.isActive && (ad.endTime >= block.timestamp || ad.endTime == type(uint256).max)) {
                activeCount++;
            }
        }

        // Build array
        Ad[] memory result = new Ad[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < carousel.length; i++) {
            Ad storage ad = ads[carousel[i]];
            if (ad.isActive && (ad.endTime >= block.timestamp || ad.endTime == type(uint256).max)) {
                result[index] = ad;
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Get all ad spaces for a location
     */
    function getSpacesForLocation(AdLocation location) external view returns (AdSpace[] memory) {
        uint256[] storage spaceIds = locationSpaces[location];
        AdSpace[] memory result = new AdSpace[](spaceIds.length);

        for (uint256 i = 0; i < spaceIds.length; i++) {
            result[i] = adSpaces[spaceIds[i]];
        }

        return result;
    }

    /**
     * @notice Get current ad for a space
     */
    function getCurrentAdForSpace(uint256 spaceId) external view returns (Ad memory) {
        uint256 adId = currentAd[spaceId];
        if (adId == 0) return Ad(0, 0, address(0), "", "", "", 0, 0, 0, false, false);

        Ad storage ad = ads[adId];
        if (!ad.isActive || (ad.endTime < block.timestamp && ad.endTime != type(uint256).max)) {
            return Ad(0, 0, address(0), "", "", "", 0, 0, 0, false, false);
        }

        return ad;
    }

    /**
     * @notice Get ad statistics
     */
    function getAdStats(uint256 adId) external view returns (uint256 impressions, uint256 clicks, uint256 ctr) {
        AdStats storage stats = adStats[adId];
        impressions = stats.impressions;
        clicks = stats.clicks;
        ctr = impressions > 0 ? (clicks * 10000) / impressions : 0; // CTR in basis points
    }

    /**
     * @notice Get available (unoccupied) ad spaces
     */
    function getAvailableSpaces() external view returns (AdSpace[] memory) {
        uint256 availableCount = 0;

        // Count available
        for (uint256 i = 1; i <= adSpaceCount; i++) {
            AdSpace storage space = adSpaces[i];
            if (space.isActive) {
                uint256 adId = currentAd[i];
                if (adId == 0) {
                    availableCount++;
                } else {
                    Ad storage ad = ads[adId];
                    if (!ad.isActive || (ad.endTime < block.timestamp && ad.endTime != type(uint256).max)) {
                        availableCount++;
                    }
                }
            }
        }

        // Build array
        AdSpace[] memory result = new AdSpace[](availableCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= adSpaceCount; i++) {
            AdSpace storage space = adSpaces[i];
            if (space.isActive) {
                uint256 adId = currentAd[i];
                if (adId == 0) {
                    result[index] = space;
                    index++;
                } else {
                    Ad storage ad = ads[adId];
                    if (!ad.isActive || (ad.endTime < block.timestamp && ad.endTime != type(uint256).max)) {
                        result[index] = space;
                        index++;
                    }
                }
            }
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN - ALL ADJUSTABLE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update weekly rate (default for all spaces)
     */
    function setWeeklyRate(uint256 _ratePLS) external onlyOwner {
        emit WeeklyRateUpdated(weeklyRatePLS, _ratePLS);
        weeklyRatePLS = _ratePLS;
    }

    /**
     * @notice Create new ad space
     */
    function createAdSpace(
        AdLocation location,
        string calldata name,
        uint256 customRate,
        bool isPremium,
        uint256 premiumMultiplier
    ) external onlyOwner returns (uint256) {
        return _createAdSpace(location, name, customRate, isPremium, premiumMultiplier);
    }

    /**
     * @notice Update ad space settings
     */
    function updateAdSpace(
        uint256 spaceId,
        uint256 weeklyRate,
        bool isActive,
        bool isPremium,
        uint256 premiumMultiplier
    ) external onlyOwner {
        AdSpace storage space = adSpaces[spaceId];
        if (space.id == 0) revert AdSpaceNotFound();

        space.weeklyRate = weeklyRate;
        space.isActive = isActive;
        space.isPremium = isPremium;
        space.premiumMultiplier = premiumMultiplier;

        emit AdSpaceUpdated(spaceId, weeklyRate, isActive);
    }

    /**
     * @notice Emergency withdraw
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent,) = TREASURY.call{value: balance}("");
            require(sent, "Withdraw failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    receive() external payable {}
}
