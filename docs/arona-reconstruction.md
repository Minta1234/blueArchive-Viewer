# Arona work scenes: evidence and remaining gaps

This reconstruction uses the installed JP game's serialized prefabs and native method bodies. It does not inspect or impersonate an account.

## Scene selection

`ScenarioResourceInfoDBSchema` contains 15 rows. `UIWork.InitSpine` calls `ScenarioResourceData.PickRandomOpenedExcel` (call site `0x181084140`, target `0x181a99670`). That method filters opened rows, sums their integer Ratio weights and selects against cumulative weights. The positive weights are row 1: 1, row 2: 99, row 3: 100, rows 12 and 13: 10,000,000 each.

`GetOpenedExcels` calls `IsOpenedOrForceEntered`. `IsOpened` (`0x181aea5e0`) accepts ScenarioModeId zero or calls `ScenarioHistoryObject.Cleared`. The force-entry predicate (`0x181aea3e0`) also compares the integer ScenarioForceEnter against an account-related value when the scenario has not been cleared. That value's exact meaning remains unresolved. ScenarioForceEnter is an int32, not a boolean.

Rows 12/13 reference scenario 201100 and the `_02_Day`/`_02_Night` prefabs. No clock threshold was found in these recovered predicates or the 15 table rows. This bounded observation does not prove that every game system is independent of time. The viewer uses explicit model selection; it does not fabricate account history or an automatic day/night schedule.

## Prefab joins

`data/arona-scenes.json` preserves five work-scene prefabs, 30 actors and all 15 selection rows. Joins follow actual SkeletonAnimation -> SkeletonDataAsset -> skeleton TextAsset pointers, rather than filename similarity.

`UIWorkAronaScene_00_Day` and `UIWorkAronaScene_01_Day` reference the same daytime skeleton but contain different actor sets. The viewer uses the later preset for this shared model. The old `arona_workpage` skeleton has no match in these five prefabs and remains in generic animation mode. The two `_02` skeletons map to their original day/night prefabs.

## Implemented behavior

- SpineScenePlayer.OnEnable (`0x1821602b0`): uniformly choose an actor whose `isIdle` flag is set.
- SetAnimation: clear only the previous actor's track indices, preserving background track 0; play every new idle track simultaneously. Zero idle MixDuration uses the skeleton's default mix.
- Interact (`0x18215ff00`): reject another click while an interaction is active; play all interaction tracks together with their explicit mix values, including zero.
- CoInteract (`0x182161360`): wait for the maximum animation duration plus entry delay, then resolve the first matching stateAfterInteraction in original hierarchy order. Until the separate Stand portrait is supported, a Stand destination returns to the previous visible idle actor instead.
- Actor Awake (`0x18215ef30`): an empty return state disables its collider. The viewer preserves that gate for Stand.
- Original BoxCollider coordinates are transformed into skeleton coordinates for clicking.

The same controller and serialized scene data are included in browser and Node Wallpaper Engine exports.

## Not reproduced

The minDuration/maxDuration fields control repeated idle dialogue, not automatic pose changes. Native dialogue mode 1 repeats ChatDialog after random waits; clicking uses mode 2. These work-scene dialogue/voice joins, emoticons, Unity FX and the separate Stand portrait are not yet reproduced. The viewer temporarily restores the previous idle actor after a reaction instead of entering the incomplete Stand state, so the character stays visible and can be touched again. This fallback differs from the original game transition. Fullscreen changes and combining catalog entries are deferred.

The extraction asserts prefab counts, unique skeleton joins, weights and every actor animation reference. Tests exercise all actor track combinations and return gates, and local checks apply the tracks to the original skeletons. Static analysis does not establish complete runtime or Wallpaper Engine parity.
