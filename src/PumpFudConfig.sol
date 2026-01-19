// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PumpFudConfig
 * @notice Central configuration registry for pump.fud platform
 * @dev ALL parameters adjustable via owner functions - NOTHING hardcoded
 *
 * This contract stores:
 * - Contract addresses (upgradeable references)
 * - Fee configurations
 * - UI settings (colors, layouts, feature flags)
 * - Component configs (swap card, token cards, etc.)
 * - Feature toggles
 *
 * Frontend reads ALL config from here.
 * Owner updates ANY setting without redeploying.
 *
 * TREASURY: 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
 */
contract PumpFudConfig is Ownable {
    address public constant TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTRACT ADDRESSES (All upgradeable)
    // ═══════════════════════════════════════════════════════════════════════════

    address public pumpFud;
    address public superChat;
    address public adManager;
    address public swap;
    address public profile;
    address public arbitrage; // PRIVATE - not exposed to frontend

    // DEX Routers
    address public pulseXV1Router = 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02;
    address public pulseXV2Router = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public paisleyRouter;

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE FLAGS (Toggle any feature on/off)
    // ═══════════════════════════════════════════════════════════════════════════

    mapping(string => bool) public featureFlags;
    string[] public featureFlagKeys;

    // ═══════════════════════════════════════════════════════════════════════════
    // UI CONFIGURATION (Frontend reads these)
    // ═══════════════════════════════════════════════════════════════════════════

    // String configs (colors, urls, text)
    mapping(string => string) public stringConfig;
    string[] public stringConfigKeys;

    // Numeric configs (sizes, counts, thresholds)
    mapping(string => uint256) public numericConfig;
    string[] public numericConfigKeys;

    // JSON configs (complex objects serialized as JSON strings)
    mapping(string => string) public jsonConfig;
    string[] public jsonConfigKeys;

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPONENT LAYOUTS (Swap cards, token cards, etc.)
    // ═══════════════════════════════════════════════════════════════════════════

    struct ComponentConfig {
        string componentId;     // "swapCard", "tokenCard", "profileCard"
        string layoutJson;      // JSON config for layout
        string styleJson;       // JSON config for styles
        bool isActive;
        uint256 version;
    }

    mapping(string => ComponentConfig) public components;
    string[] public componentIds;

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE LAYOUTS
    // ═══════════════════════════════════════════════════════════════════════════

    struct PageConfig {
        string pageId;          // "landing", "tokenList", "dashboard", "swap"
        string layoutJson;      // Grid layout, component order
        string sectionsJson;    // Which sections to show
        bool isActive;
        uint256 version;
    }

    mapping(string => PageConfig) public pages;
    string[] public pageIds;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ContractAddressUpdated(string indexed name, address oldAddr, address newAddr);
    event FeatureFlagUpdated(string indexed flag, bool value);
    event StringConfigUpdated(string indexed key, string value);
    event NumericConfigUpdated(string indexed key, uint256 value);
    event JsonConfigUpdated(string indexed key);
    event ComponentUpdated(string indexed componentId, uint256 version);
    event PageUpdated(string indexed pageId, uint256 version);

    constructor() Ownable(msg.sender) {
        _initializeDefaults();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZE DEFAULTS
    // ═══════════════════════════════════════════════════════════════════════════

    function _initializeDefaults() internal {
        // Feature flags
        _setFeatureFlag("swapEnabled", true);
        _setFeatureFlag("liveChatEnabled", true);
        _setFeatureFlag("messageBoardEnabled", true);
        _setFeatureFlag("adsEnabled", true);
        _setFeatureFlag("profilesEnabled", true);
        _setFeatureFlag("cultsEnabled", true);
        _setFeatureFlag("nsfwFilterEnabled", true);
        _setFeatureFlag("mayhemModeEnabled", true);
        _setFeatureFlag("limitOrdersEnabled", true);
        _setFeatureFlag("superChatEnabled", true);

        // UI Colors (CSS variables)
        _setStringConfig("primaryColor", "#00ff88");
        _setStringConfig("secondaryColor", "#1a1a2e");
        _setStringConfig("accentColor", "#00d4ff");
        _setStringConfig("backgroundColor", "#0a0a0f");
        _setStringConfig("cardBackground", "#1a1a2e");
        _setStringConfig("textPrimary", "#ffffff");
        _setStringConfig("textSecondary", "#888888");
        _setStringConfig("successColor", "#00ff88");
        _setStringConfig("errorColor", "#ff4444");
        _setStringConfig("warningColor", "#ffaa00");

        // Branding
        _setStringConfig("platformName", "pump.fud");
        _setStringConfig("logoUrl", "/branding/logo-main.jpg");
        _setStringConfig("heroImageUrl", "/branding/hero-main.jpg");
        _setStringConfig("faviconUrl", "/favicon.ico");

        // Layout settings
        _setNumericConfig("tokenGridColumns", 4);
        _setNumericConfig("tokenCardWidth", 280);
        _setNumericConfig("streamGridColumns", 4);
        _setNumericConfig("carouselSpeed", 5000);
        _setNumericConfig("maxTokensPerPage", 50);
        _setNumericConfig("chatMessageLimit", 100);

        // Default component configs
        _setComponent("swapCard",
            '{"width":"400px","padding":"24px","borderRadius":"16px"}',
            '{"background":"var(--cardBackground)","border":"1px solid var(--primaryColor)"}',
            true
        );

        _setComponent("tokenCard",
            '{"width":"280px","aspectRatio":"1","showPrice":true,"showVolume":true,"showChart":true}',
            '{"background":"var(--cardBackground)","hoverScale":"1.02"}',
            true
        );

        _setComponent("profileCard",
            '{"showAvatar":true,"showBadges":true,"showCult":true,"showStats":true}',
            '{"background":"var(--cardBackground)","avatarSize":"80px"}',
            true
        );

        _setComponent("chatMessage",
            '{"showAvatar":true,"showTier":true,"maxLength":280}',
            '{"tierColors":{"bronze":"#cd7f32","silver":"#c0c0c0","gold":"#ffd700","diamond":"#b9f2ff"}}',
            true
        );

        // Default page configs
        _setPage("landing",
            '{"sections":["hero","carousel","featuredTokens","recentLaunches","liveStreams","footer"]}',
            '{"hero":true,"carousel":true,"featuredTokens":true,"recentLaunches":true,"liveStreams":true,"ads":true}',
            true
        );

        _setPage("tokenList",
            '{"layout":"grid","filters":["featured","topMarketCap","mostViewers","nsfw"],"sortOptions":["newest","volume","price"]}',
            '{"filters":true,"search":true,"pagination":true}',
            true
        );

        _setPage("swap",
            '{"layout":"centered","showChart":true,"showRecentTrades":true,"showPositions":true}',
            '{"chart":true,"recentTrades":true,"positions":true}',
            true
        );

        _setPage("dashboard",
            '{"layout":"split","leftPanel":"chart","rightPanel":"chat","bottomPanel":"trades"}',
            '{"liveChat":true,"messageBoard":true,"voiceChat":true,"superChat":true}',
            true
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTRACT ADDRESS SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setPumpFud(address _addr) external onlyOwner {
        emit ContractAddressUpdated("pumpFud", pumpFud, _addr);
        pumpFud = _addr;
    }

    function setSuperChat(address _addr) external onlyOwner {
        emit ContractAddressUpdated("superChat", superChat, _addr);
        superChat = _addr;
    }

    function setAdManager(address _addr) external onlyOwner {
        emit ContractAddressUpdated("adManager", adManager, _addr);
        adManager = _addr;
    }

    function setSwap(address _addr) external onlyOwner {
        emit ContractAddressUpdated("swap", swap, _addr);
        swap = _addr;
    }

    function setProfile(address _addr) external onlyOwner {
        emit ContractAddressUpdated("profile", profile, _addr);
        profile = _addr;
    }

    function setArbitrage(address _addr) external onlyOwner {
        emit ContractAddressUpdated("arbitrage", arbitrage, _addr);
        arbitrage = _addr;
    }

    function setPulseXV1Router(address _addr) external onlyOwner {
        emit ContractAddressUpdated("pulseXV1Router", pulseXV1Router, _addr);
        pulseXV1Router = _addr;
    }

    function setPulseXV2Router(address _addr) external onlyOwner {
        emit ContractAddressUpdated("pulseXV2Router", pulseXV2Router, _addr);
        pulseXV2Router = _addr;
    }

    function setPaisleyRouter(address _addr) external onlyOwner {
        emit ContractAddressUpdated("paisleyRouter", paisleyRouter, _addr);
        paisleyRouter = _addr;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE FLAG SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setFeatureFlag(string calldata flag, bool value) external onlyOwner {
        _setFeatureFlag(flag, value);
    }

    function _setFeatureFlag(string memory flag, bool value) internal {
        if (!featureFlags[flag] && value) {
            featureFlagKeys.push(flag);
        }
        featureFlags[flag] = value;
        emit FeatureFlagUpdated(flag, value);
    }

    function setBatchFeatureFlags(string[] calldata flags, bool[] calldata values) external onlyOwner {
        require(flags.length == values.length, "Length mismatch");
        for (uint i = 0; i < flags.length; i++) {
            _setFeatureFlag(flags[i], values[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STRING CONFIG SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setStringConfig(string calldata key, string calldata value) external onlyOwner {
        _setStringConfig(key, value);
    }

    function _setStringConfig(string memory key, string memory value) internal {
        if (bytes(stringConfig[key]).length == 0 && bytes(value).length > 0) {
            stringConfigKeys.push(key);
        }
        stringConfig[key] = value;
        emit StringConfigUpdated(key, value);
    }

    function setBatchStringConfig(string[] calldata keys, string[] calldata values) external onlyOwner {
        require(keys.length == values.length, "Length mismatch");
        for (uint i = 0; i < keys.length; i++) {
            _setStringConfig(keys[i], values[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NUMERIC CONFIG SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setNumericConfig(string calldata key, uint256 value) external onlyOwner {
        _setNumericConfig(key, value);
    }

    function _setNumericConfig(string memory key, uint256 value) internal {
        if (numericConfig[key] == 0 && value > 0) {
            numericConfigKeys.push(key);
        }
        numericConfig[key] = value;
        emit NumericConfigUpdated(key, value);
    }

    function setBatchNumericConfig(string[] calldata keys, uint256[] calldata values) external onlyOwner {
        require(keys.length == values.length, "Length mismatch");
        for (uint i = 0; i < keys.length; i++) {
            _setNumericConfig(keys[i], values[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON CONFIG SETTERS (Complex objects)
    // ═══════════════════════════════════════════════════════════════════════════

    function setJsonConfig(string calldata key, string calldata jsonValue) external onlyOwner {
        _setJsonConfig(key, jsonValue);
    }

    function _setJsonConfig(string memory key, string memory jsonValue) internal {
        if (bytes(jsonConfig[key]).length == 0 && bytes(jsonValue).length > 0) {
            jsonConfigKeys.push(key);
        }
        jsonConfig[key] = jsonValue;
        emit JsonConfigUpdated(key);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPONENT CONFIG SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setComponent(
        string calldata componentId,
        string calldata layoutJson,
        string calldata styleJson,
        bool isActive
    ) external onlyOwner {
        _setComponent(componentId, layoutJson, styleJson, isActive);
    }

    function _setComponent(
        string memory componentId,
        string memory layoutJson,
        string memory styleJson,
        bool isActive
    ) internal {
        ComponentConfig storage comp = components[componentId];

        if (bytes(comp.componentId).length == 0) {
            componentIds.push(componentId);
        }

        comp.componentId = componentId;
        comp.layoutJson = layoutJson;
        comp.styleJson = styleJson;
        comp.isActive = isActive;
        comp.version++;

        emit ComponentUpdated(componentId, comp.version);
    }

    function setComponentActive(string calldata componentId, bool isActive) external onlyOwner {
        components[componentId].isActive = isActive;
        components[componentId].version++;
        emit ComponentUpdated(componentId, components[componentId].version);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE CONFIG SETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    function setPage(
        string calldata pageId,
        string calldata layoutJson,
        string calldata sectionsJson,
        bool isActive
    ) external onlyOwner {
        _setPage(pageId, layoutJson, sectionsJson, isActive);
    }

    function _setPage(
        string memory pageId,
        string memory layoutJson,
        string memory sectionsJson,
        bool isActive
    ) internal {
        PageConfig storage page = pages[pageId];

        if (bytes(page.pageId).length == 0) {
            pageIds.push(pageId);
        }

        page.pageId = pageId;
        page.layoutJson = layoutJson;
        page.sectionsJson = sectionsJson;
        page.isActive = isActive;
        page.version++;

        emit PageUpdated(pageId, page.version);
    }

    function setPageActive(string calldata pageId, bool isActive) external onlyOwner {
        pages[pageId].isActive = isActive;
        pages[pageId].version++;
        emit PageUpdated(pageId, pages[pageId].version);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS - Frontend reads these
    // ═══════════════════════════════════════════════════════════════════════════

    function getAllContracts() external view returns (
        address _pumpFud,
        address _superChat,
        address _adManager,
        address _swap,
        address _profile
    ) {
        return (pumpFud, superChat, adManager, swap, profile);
    }

    function getAllRouters() external view returns (
        address _pulseXV1,
        address _pulseXV2,
        address _paisley
    ) {
        return (pulseXV1Router, pulseXV2Router, paisleyRouter);
    }

    function getFeatureFlagKeys() external view returns (string[] memory) {
        return featureFlagKeys;
    }

    function getStringConfigKeys() external view returns (string[] memory) {
        return stringConfigKeys;
    }

    function getNumericConfigKeys() external view returns (string[] memory) {
        return numericConfigKeys;
    }

    function getJsonConfigKeys() external view returns (string[] memory) {
        return jsonConfigKeys;
    }

    function getComponentIds() external view returns (string[] memory) {
        return componentIds;
    }

    function getPageIds() external view returns (string[] memory) {
        return pageIds;
    }

    function getComponent(string calldata componentId) external view returns (ComponentConfig memory) {
        return components[componentId];
    }

    function getPage(string calldata pageId) external view returns (PageConfig memory) {
        return pages[pageId];
    }

    // Bulk getters for frontend initialization
    function getAllFeatureFlags() external view returns (string[] memory keys, bool[] memory values) {
        keys = featureFlagKeys;
        values = new bool[](keys.length);
        for (uint i = 0; i < keys.length; i++) {
            values[i] = featureFlags[keys[i]];
        }
    }

    function getAllStringConfigs() external view returns (string[] memory keys, string[] memory values) {
        keys = stringConfigKeys;
        values = new string[](keys.length);
        for (uint i = 0; i < keys.length; i++) {
            values[i] = stringConfig[keys[i]];
        }
    }

    function getAllNumericConfigs() external view returns (string[] memory keys, uint256[] memory values) {
        keys = numericConfigKeys;
        values = new uint256[](keys.length);
        for (uint i = 0; i < keys.length; i++) {
            values[i] = numericConfig[keys[i]];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EMERGENCY
    // ═══════════════════════════════════════════════════════════════════════════

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent,) = TREASURY.call{value: balance}("");
            require(sent, "Withdraw failed");
        }
    }

    receive() external payable {}
}
