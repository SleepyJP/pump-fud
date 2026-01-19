// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PumpFudConfig} from "../src/PumpFudConfig.sol";

contract PumpFudConfigTest is Test {
    PumpFudConfig public config;

    address public owner = address(this);
    address public user1 = address(0x1);

    function setUp() public {
        config = new PumpFudConfig();
    }

    // ============ DEPLOYMENT TESTS ============

    function test_Deployment() public view {
        assertEq(config.owner(), owner);
        assertEq(config.TREASURY(), 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B);
    }

    function test_DefaultContractAddresses() public view {
        assertEq(config.pumpFud(), address(0));
        assertEq(config.superChat(), address(0));
        assertEq(config.adManager(), address(0));
        assertEq(config.profile(), address(0));
        assertEq(config.swap(), address(0));
        assertEq(config.arbitrage(), address(0));
    }

    function test_DefaultRouters() public view {
        assertEq(config.pulseXV1Router(), 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02);
        assertEq(config.pulseXV2Router(), 0x165C3410fC91EF562C50559f7d2289fEbed552d9);
        assertEq(config.paisleyRouter(), address(0));
    }

    function test_DefaultFeatureFlags() public view {
        assertTrue(config.featureFlags("swapEnabled"));
        assertTrue(config.featureFlags("liveChatEnabled"));
        assertTrue(config.featureFlags("adsEnabled"));
        assertTrue(config.featureFlags("profilesEnabled"));
        assertTrue(config.featureFlags("nsfwFilterEnabled"));
        assertTrue(config.featureFlags("mayhemModeEnabled"));
        assertTrue(config.featureFlags("superChatEnabled"));
    }

    // ============ CONTRACT ADDRESS TESTS ============

    function test_SetContractAddresses() public {
        address pump = address(0x111);
        address superChatAddr = address(0x222);
        address adMgr = address(0x333);
        address profileAddr = address(0x444);
        address swapAddr = address(0x555);
        address arb = address(0x666);

        config.setPumpFud(pump);
        config.setSuperChat(superChatAddr);
        config.setAdManager(adMgr);
        config.setProfile(profileAddr);
        config.setSwap(swapAddr);
        config.setArbitrage(arb);

        assertEq(config.pumpFud(), pump);
        assertEq(config.superChat(), superChatAddr);
        assertEq(config.adManager(), adMgr);
        assertEq(config.profile(), profileAddr);
        assertEq(config.swap(), swapAddr);
        assertEq(config.arbitrage(), arb);
    }

    function test_OnlyOwnerCanSetContractAddresses() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setPumpFud(address(0x111));
    }

    // ============ ROUTER TESTS ============

    function test_SetRouters() public {
        address v1 = address(0x111);
        address v2 = address(0x222);
        address paisley = address(0x333);

        config.setPulseXV1Router(v1);
        config.setPulseXV2Router(v2);
        config.setPaisleyRouter(paisley);

        assertEq(config.pulseXV1Router(), v1);
        assertEq(config.pulseXV2Router(), v2);
        assertEq(config.paisleyRouter(), paisley);
    }

    // ============ FEATURE FLAG TESTS ============

    function test_SetFeatureFlag() public {
        config.setFeatureFlag("newFeature", true);
        assertTrue(config.featureFlags("newFeature"));

        config.setFeatureFlag("newFeature", false);
        assertFalse(config.featureFlags("newFeature"));
    }

    function test_BatchSetFeatureFlags() public {
        string[] memory keys = new string[](3);
        keys[0] = "feature1";
        keys[1] = "feature2";
        keys[2] = "feature3";

        bool[] memory values = new bool[](3);
        values[0] = true;
        values[1] = false;
        values[2] = true;

        config.setBatchFeatureFlags(keys, values);

        assertTrue(config.featureFlags("feature1"));
        assertFalse(config.featureFlags("feature2"));
        assertTrue(config.featureFlags("feature3"));
    }

    function test_OnlyOwnerCanSetFeatureFlag() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setFeatureFlag("test", true);
    }

    // ============ STRING CONFIG TESTS ============

    function test_SetStringConfig() public {
        config.setStringConfig("customKey", "customValue");
        assertEq(config.stringConfig("customKey"), "customValue");
    }

    function test_BatchSetStringConfigs() public {
        string[] memory keys = new string[](2);
        keys[0] = "key1";
        keys[1] = "key2";

        string[] memory values = new string[](2);
        values[0] = "value1";
        values[1] = "value2";

        config.setBatchStringConfig(keys, values);

        assertEq(config.stringConfig("key1"), "value1");
        assertEq(config.stringConfig("key2"), "value2");
    }

    function test_DefaultColors() public view {
        assertEq(config.stringConfig("primaryColor"), "#00ff88");
        assertEq(config.stringConfig("secondaryColor"), "#1a1a2e");
        assertEq(config.stringConfig("backgroundColor"), "#0a0a0f");
        assertEq(config.stringConfig("textPrimary"), "#ffffff");
        assertEq(config.stringConfig("accentColor"), "#00d4ff");
        assertEq(config.stringConfig("successColor"), "#00ff88");
        assertEq(config.stringConfig("errorColor"), "#ff4444");
        assertEq(config.stringConfig("warningColor"), "#ffaa00");
    }

    function test_DefaultBranding() public view {
        assertEq(config.stringConfig("platformName"), "pump.fud");
        assertEq(config.stringConfig("logoUrl"), "/branding/logo-main.jpg");
        assertEq(config.stringConfig("heroImageUrl"), "/branding/hero-main.jpg");
        assertEq(config.stringConfig("faviconUrl"), "/favicon.ico");
    }

    // ============ NUMERIC CONFIG TESTS ============

    function test_SetNumericConfig() public {
        config.setNumericConfig("maxTokens", 1000);
        assertEq(config.numericConfig("maxTokens"), 1000);
    }

    function test_BatchSetNumericConfigs() public {
        string[] memory keys = new string[](2);
        keys[0] = "num1";
        keys[1] = "num2";

        uint256[] memory values = new uint256[](2);
        values[0] = 100;
        values[1] = 200;

        config.setBatchNumericConfig(keys, values);

        assertEq(config.numericConfig("num1"), 100);
        assertEq(config.numericConfig("num2"), 200);
    }

    function test_DefaultNumericConfigs() public view {
        assertEq(config.numericConfig("tokenGridColumns"), 4);
        assertEq(config.numericConfig("tokenCardWidth"), 280);
        assertEq(config.numericConfig("streamGridColumns"), 4);
        assertEq(config.numericConfig("carouselSpeed"), 5000);
        assertEq(config.numericConfig("maxTokensPerPage"), 50);
        assertEq(config.numericConfig("chatMessageLimit"), 100);
    }

    // ============ JSON CONFIG TESTS ============

    function test_SetJsonConfig() public {
        string memory json = '{"key": "value", "num": 123}';
        config.setJsonConfig("testConfig", json);
        assertEq(config.jsonConfig("testConfig"), json);
    }

    // ============ COMPONENT CONFIG TESTS ============

    function test_SetComponent() public {
        config.setComponent(
            "myComponent",
            '{"width": "100%"}',
            '{"padding": "10px"}',
            true
        );

        PumpFudConfig.ComponentConfig memory comp = config.getComponent("myComponent");
        assertEq(comp.componentId, "myComponent");
        assertEq(comp.layoutJson, '{"width": "100%"}');
        assertEq(comp.styleJson, '{"padding": "10px"}');
        assertTrue(comp.isActive);
        assertEq(comp.version, 1);
    }

    function test_UpdateComponentIncrementsVersion() public {
        config.setComponent("test", '{"v":1}', '{}', true);
        config.setComponent("test", '{"v":2}', '{}', true);

        PumpFudConfig.ComponentConfig memory comp = config.getComponent("test");
        assertEq(comp.version, 2);
        assertEq(comp.layoutJson, '{"v":2}');
    }

    function test_SetComponentActive() public {
        config.setComponent("test", '{}', '{}', true);
        assertTrue(config.getComponent("test").isActive);

        config.setComponentActive("test", false);
        assertFalse(config.getComponent("test").isActive);
    }

    function test_DefaultComponents() public view {
        PumpFudConfig.ComponentConfig memory tokenCard = config.getComponent("tokenCard");
        assertTrue(tokenCard.isActive);
        assertGt(bytes(tokenCard.layoutJson).length, 0);

        PumpFudConfig.ComponentConfig memory swapCard = config.getComponent("swapCard");
        assertTrue(swapCard.isActive);

        PumpFudConfig.ComponentConfig memory profileCard = config.getComponent("profileCard");
        assertTrue(profileCard.isActive);

        PumpFudConfig.ComponentConfig memory chatMessage = config.getComponent("chatMessage");
        assertTrue(chatMessage.isActive);
    }

    // ============ PAGE CONFIG TESTS ============

    function test_SetPage() public {
        config.setPage(
            "myPage",
            '{"grid": "2x2"}',
            '["header", "content", "footer"]',
            true
        );

        PumpFudConfig.PageConfig memory page = config.getPage("myPage");
        assertEq(page.pageId, "myPage");
        assertEq(page.layoutJson, '{"grid": "2x2"}');
        assertEq(page.sectionsJson, '["header", "content", "footer"]');
        assertTrue(page.isActive);
        assertEq(page.version, 1);
    }

    function test_UpdatePageIncrementsVersion() public {
        config.setPage("test", '{"v":1}', '[]', true);
        config.setPage("test", '{"v":2}', '[]', true);

        PumpFudConfig.PageConfig memory page = config.getPage("test");
        assertEq(page.version, 2);
    }

    function test_SetPageActive() public {
        config.setPage("test", '{}', '[]', true);
        assertTrue(config.getPage("test").isActive);

        config.setPageActive("test", false);
        assertFalse(config.getPage("test").isActive);
    }

    function test_DefaultPages() public view {
        PumpFudConfig.PageConfig memory landing = config.getPage("landing");
        assertTrue(landing.isActive);
        assertGt(bytes(landing.layoutJson).length, 0);

        PumpFudConfig.PageConfig memory tokenList = config.getPage("tokenList");
        assertTrue(tokenList.isActive);

        PumpFudConfig.PageConfig memory swapPage = config.getPage("swap");
        assertTrue(swapPage.isActive);

        PumpFudConfig.PageConfig memory dashboard = config.getPage("dashboard");
        assertTrue(dashboard.isActive);
    }

    // ============ BULK GETTER TESTS ============

    function test_GetAllContracts() public {
        config.setPumpFud(address(0x111));
        config.setSuperChat(address(0x222));

        (
            address _pumpFud,
            address _superChat,
            address _adManager,
            address _swap,
            address _profile
        ) = config.getAllContracts();

        assertEq(_pumpFud, address(0x111));
        assertEq(_superChat, address(0x222));
        assertEq(_adManager, address(0));
        assertEq(_swap, address(0));
        assertEq(_profile, address(0));
    }

    function test_GetAllRouters() public view {
        (
            address _pulseXV1,
            address _pulseXV2,
            address _paisley
        ) = config.getAllRouters();

        assertEq(_pulseXV1, 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02);
        assertEq(_pulseXV2, 0x165C3410fC91EF562C50559f7d2289fEbed552d9);
        assertEq(_paisley, address(0));
    }

    function test_GetAllFeatureFlags() public view {
        (string[] memory keys, bool[] memory values) = config.getAllFeatureFlags();
        assertGt(keys.length, 0);
        assertEq(keys.length, values.length);
    }

    function test_GetAllStringConfigs() public view {
        (string[] memory keys, string[] memory values) = config.getAllStringConfigs();
        assertGt(keys.length, 0);
        assertEq(keys.length, values.length);
    }

    function test_GetAllNumericConfigs() public view {
        (string[] memory keys, uint256[] memory values) = config.getAllNumericConfigs();
        assertGt(keys.length, 0);
        assertEq(keys.length, values.length);
    }

    function test_GetComponentIds() public view {
        string[] memory ids = config.getComponentIds();
        assertGt(ids.length, 0);
    }

    function test_GetPageIds() public view {
        string[] memory ids = config.getPageIds();
        assertGt(ids.length, 0);
    }

    // ============ ACCESS CONTROL TESTS ============

    function test_OnlyOwnerCanSetStringConfig() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setStringConfig("test", "value");
    }

    function test_OnlyOwnerCanSetNumericConfig() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setNumericConfig("test", 123);
    }

    function test_OnlyOwnerCanSetJsonConfig() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setJsonConfig("test", "{}");
    }

    function test_OnlyOwnerCanSetComponent() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setComponent("test", "{}", "{}", true);
    }

    function test_OnlyOwnerCanSetPage() public {
        vm.prank(user1);
        vm.expectRevert();
        config.setPage("test", "{}", "[]", true);
    }

    // ============ EMERGENCY TESTS ============

    function test_EmergencyWithdraw() public {
        vm.deal(address(config), 10 ether);

        address treasury = config.TREASURY();
        uint256 treasuryBefore = treasury.balance;

        config.emergencyWithdraw();

        uint256 treasuryAfter = treasury.balance;
        assertEq(treasuryAfter - treasuryBefore, 10 ether);
    }

    function test_OnlyOwnerCanEmergencyWithdraw() public {
        vm.deal(address(config), 10 ether);

        vm.prank(user1);
        vm.expectRevert();
        config.emergencyWithdraw();
    }

    function test_ReceiveEther() public {
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        (bool success,) = address(config).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(config).balance, 1 ether);
    }

    // ============ EDGE CASE TESTS ============

    function test_EmptyStringConfig() public {
        config.setStringConfig("empty", "");
        assertEq(config.stringConfig("empty"), "");
    }

    function test_ZeroNumericConfig() public {
        config.setNumericConfig("zero", 0);
        assertEq(config.numericConfig("zero"), 0);
    }

    function test_LargeJsonConfig() public {
        string memory largeJson = '{"data": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]}';
        config.setJsonConfig("large", largeJson);
        assertEq(config.jsonConfig("large"), largeJson);
    }
}
