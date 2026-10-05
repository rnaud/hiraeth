# Mixamo shopping list

What to download from https://www.mixamo.com/ (your Adobe login) to fill what the CMU takes lack:
clean starts, stops, turns on the spot and pivots, idles, talking gestures, kneeling and sitting,
climbing and ledges, carrying, swimming, falling and gliding, petting the dog, laying something
down. The pipeline (`scripts/mocap/`, README "Motion capture") picks the files up from
`data/mocap/mixamo/` (git-ignored) and converts them with the rest; the terms are in
docs/motion-data.md.

## For every download

1. Character: keep Mixamo's default, **Y Bot** (any Mixamo rig works; Y Bot keeps them alike).
2. Search the **name** below on mixamo.com. Several animations share a name: pick the one whose
   description (under the thumbnail) matches the **description** column.
3. Leave the sliders as they are, except: tick **In Place** where the table says *yes*, untick it
   where it says *no* (starts, stops and turns need the body's own travel: the matcher reads it).
4. Download with: **Format FBX Binary (.fbx)**, **Skin: Without Skin**, **Frames per Second: 30**,
   **Keyframe Reduction: none**.
5. Save it as `data/mocap/mixamo/<file>.fbx`, with the **file** name from the table (Mixamo names
   downloads after the animation, and several share a name).
6. When done (or after any batch): `node scripts/mocap/build-library.mjs`, then
   `node --test tests/*.test.js`. Files not in the table are skipped with a warning; the table
   itself is `scripts/mocap/mixamo-clips.json` (add a row there to take more).

**use** says where a clip goes: *mm* the traveller's motion-matching database
(`public/anim/locomotion.glb`), *npc* a person's walk (`public/anim/walks.glb`), *clip* shipped as
a clip of its own for later work (listed in the character studio), *ref* converted, not shipped.

## Starts, stops and turns (the matcher's gaps)

The CMU takes start and stop slower than the game's controller and have no quick turns at a
run; these are the clips the matcher lacks most (README "Motion capture", the results).

| file | name | description | In Place | use |
|---|---|---|---|---|
| start_walking | Start Walking | Walking From Standing | no | mm |
| stop_walking | Stop Walking | Walking To Standing Idle | no | mm |
| female_start_walking | Female Start Walking | Female Start Walking | no | mm |
| female_stop_walking | Female Stop Walking | Female Stop Walking | no | mm |
| walking_left_turn | Walking Left Turn | Turning Left While Walking | no | mm |
| walking_turn_180 | Walking Turn 180 | Turning 180 Degrees While Walking | no | mm |
| jogging | Jogging | Jogging | no | mm |
| standard_run | Standard Run | Standard Running | no | mm |
| fast_run | Fast Run | Running Fast | no | mm |
| run_to_stop | Run To Stop | Fast Stop From Full Run | no | mm |
| running_turn_180 | Running Turn 180 | Turning 180 Degrees While Running | no | mm |
| running_to_turn | Running To Turn | Fast Run To 180 Degree Turn | no | mm |
| change_direction | Change Direction | Change Direction 180 Degrees While Running | no | mm |
| running_right_turn | Running Right Turn | Turning Right While Running | no | mm |
| turn_to_running | Turn To Running | Turn Right And Run | no | mm |
| sprint_turn | Sprint Turn | Turning While Sprinting | no | mm |
| left_turn_90 | Left Turn 90 | Standing Left Turn | no | mm |
| right_turn_90 | Right Turn 90 | Standing Right Turn | no | mm |
| left_turn_180 | Left Turn | Standing 180 Left Turn | no | mm |
| left_turn_45 | Left Turn 45 | 45 Degree Left Turn From Idle | no | mm |
| quick_right_turn | Turning Right | Quick 90 Degree Right Turn | no | mm |
| turning_in_place | Turning | Turning In Place | no | mm |
| left_strafe_walking | Left Strafe Walking | Strafe Walking To The Left | no | mm |
| walking_backwards | Walking Backwards | Male Walk Backwards | no | mm |
| running_backward | Running Backward | Backwards Running | no | mm |

(Left and right: one of each is enough, the runtime mirrors every clip.)

## Standing

| file | name | description | In Place | use |
|---|---|---|---|---|
| idle_weight_shift | Idle | Weight Shift Idle | yes | mm |
| breathing_idle | Breathing Idle | Breathing Idle | yes | mm |
| weight_shift | Weight Shift | Shifting Weight From Side To Side | yes | mm |
| neutral_idle | Neutral Idle | Neutral Idle | yes | mm |
| looking_around | Looking Around | Idle Stand Looking Around | yes | clip |
| old_man_idle | Old Man Idle | Old Man Standing Idle | yes | clip |
| happy_idle | Happy Idle | Happy Idle Variation 1 | yes | clip |

## Talking and gestures

| file | name | description | In Place | use |
|---|---|---|---|---|
| talking_conversation | Talking | General Conversation | yes | clip |
| talking_question | Talking | Asking A Question With One Hand | yes | clip |
| head_nod_yes | Head Nod Yes | Nodding Head Yes | yes | clip |
| shrugging | Shrugging | Shoulder Shrug | yes | clip |
| pointing | Pointing | Pointing With Arm Bent | yes | clip |
| waving | Waving | Waving | yes | clip |

## Kneeling and sitting

| file | name | description | In Place | use |
|---|---|---|---|---|
| kneeling_down | Kneeling Down | Standing To Kneeling Down | yes | clip |
| kneeling_idle | Kneeling Idle | Kneeling Idle | yes | clip |
| kneel_stand_up | Standing | Standing Up From A Kneeling Position | yes | clip |
| kneeling_inspecting | Kneeling Inspecting | Kneeling And Inspecting Element With Hands | yes | clip |
| stand_to_sit | Stand To Sit | Standing To Sitting Transition | yes | clip |
| sitting_idle | Sitting Idle | Sitting With Breathing Idle | yes | clip |
| sit_to_stand | Sit To Stand | Sitting To Standing | yes | clip |
| sitting_floor | Sitting Idle | Sitting On The Floor | yes | clip |

## Climbing and ledges

| file | name | description | In Place | use |
|---|---|---|---|---|
| climbing_up_wall | Climbing Up Wall | Climbing Up A Wall | yes | clip |
| climbing_down_wall | Climbing Down Wall | Climbing Down A Wall | yes | clip |
| hanging_idle | Hanging Idle | Hanging From A Ledge Idle | yes | clip |
| jump_to_hang | Jumping To Hanging | Ledge Hit To Hanging Braced | no | clip |
| braced_hang_to_crouch | Braced Hang To Crouch | Climb Wall From Braced Hang To Crouch | no | clip |
| freehang_climb | Freehang Climb | Freehang Climb To Standing | no | clip |
| pull_up_ledge | Climbing | Pulling Up To A Ledge | no | clip |
| climb_onto_box | Climbing | Starting To Climb Onto A Box Or Short Fence | no | clip |
| climbing_ladder | Climbing Ladder | Climbing Up A Ladder | yes | clip |
| climbing_to_top | Climbing To Top | Climbing Up A Ladder To Standing | no | clip |

## Carrying, objects, the dog

| file | name | description | In Place | use |
|---|---|---|---|---|
| box_idle | Box Idle | Carrying A Box | yes | clip |
| holding_walk | Holding Walk | Holding An Object While Walking | yes | clip |
| jogging_with_box | Jogging With Box | Jogging While Carrying A Box | yes | clip |
| picking_up | Picking Up | Picking Up An Object | yes | clip |
| putting_down | Putting Down | Putting Down An Object | yes | clip |
| petting_animal | Petting Animal | Petting An Animal | yes | clip |

## Water, falling, gliding, landing

Mixamo's catalogue has no front-crawl or breaststroke loop under those names: *Swimming*
(underwater) is its one stroke loop, *Swimming To Edge* is breaststroke (to a pool's edge),
*Treading Water* floats; for a dive, *Falling Into Pool*. Check the thumbnails before
downloading.
CMU's 125_01 (breaststroke) and 125_06 / 126_10 (freestyle) are converted too (docs/motion-data.md).

| file | name | description | In Place | use |
|---|---|---|---|---|
| swimming | Swimming | Swimming Underwater | yes | clip |
| swimming_to_edge | Swimming To Edge | Swimming Breastroke To Edge Of Pool | yes | clip |
| treading_water | Treading Water | Floating | yes | clip |
| falling_into_pool | Falling Into Pool | Losing Balance And Falling Forward Into A Pool | no | clip |
| falling_idle | Falling Idle | Mid-Air Falling Idle | yes | clip |
| flying | Flying | Flying Idle | yes | clip |
| falling_to_landing | Falling To Landing | Landing From Falling Idle | yes | clip |
| hard_landing | Hard Landing | Mid-Air Falling To A Hard Landing | yes | clip |
| landing | Landing | Landing From Jump | yes | clip |

## Children, and the rest

Mixamo has no child walk as such; *Happy Walk* is the lightest, bounciest one, and the bench
sitting is a little girl's (Lou, at home).

| file | name | description | In Place | use |
|---|---|---|---|---|
| happy_walk | Happy Walk | Happy Walking Forward | no | npc |
| goofy_running | Goofy Running | Feminine Scared Cartoon-Like Goofy Run | no | ref |
| girl_sitting_bench | Sitting | Little Girl Sitting On A Bench Swinging Her Legs | yes | clip |
| walking_up_stairs | Walking Up The Stairs | Male Walk Up The Stairs | no | ref |

The names and descriptions were checked against mixamo.com's catalogue on 2026-10-05.
