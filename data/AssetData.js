// Asset path and visual-state helpers.
// This module is opt-in: importing it prepares asset wiring without placing images.

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach((child) => {
    deepFreeze(child);
  });

  return value;
}

export const STOCK_VISUAL_STATES = Object.freeze({
  EMPTY: "empty",
  HALF: "half",
  FULL: "full"
});

export const STOCK_VISUAL_OBJECT_TYPES = Object.freeze({
  DISPLAY_STAND: "displayStand",
  FRESH_SHELF: "freshShelf",
  BEVERAGE_FRIDGE: "beverageFridge",
  FOOD_WARMER: "foodWarmer"
});

export const OBJECT_FACINGS = Object.freeze({
  LEFT: "left",
  RIGHT: "right"
});

export const UI_BUTTON_STATES = Object.freeze({
  NORMAL: "normal",
  PRESSED: "pressed",
  DISABLED: "disabled"
});


export const CUSTOMER_ASSET_DIRECTIONS = Object.freeze([
  "down",
  "down_left",
  "down_right",
  "left",
  "right",
  "up",
  "up_left",
  "up_right"
]);


export const STAFF_ASSET_DIRECTIONS = CUSTOMER_ASSET_DIRECTIONS;

function createStaffDirectionalAssetSet(folderName, filePrefix) {
  return STAFF_ASSET_DIRECTIONS.reduce((assets, direction) => {
    assets[direction] = `./assets/images/staff/${folderName}/${filePrefix}_${direction}.png`;
    return assets;
  }, {});
}

export const STAFF_ASSET_VARIANTS = deepFreeze({
  staff_male_cashier: createStaffDirectionalAssetSet("staff_male_cashier", "staff_male_cashier"),
  staff_female_glasses: createStaffDirectionalAssetSet("staff_female_glasses", "staff_female_glasses"),
  staff_female_friendly: createStaffDirectionalAssetSet("staff_female_friendly", "staff_female_friendly")
});

function createCustomerDirectionalAssetSet(folderName, filePrefix) {
  return CUSTOMER_ASSET_DIRECTIONS.reduce((assets, direction) => {
    assets[direction] = `./assets/images/customers/${folderName}/${filePrefix}_${direction}.png`;
    return assets;
  }, {});
}

export const CUSTOMER_ASSET_VARIANTS = deepFreeze({
  normal_v2: createCustomerDirectionalAssetSet("normal_v2", "customer_normal_v2"),
  student_male: createCustomerDirectionalAssetSet("student_male", "customer_student_male"),
  student_female: createCustomerDirectionalAssetSet("student_female", "customer_student_female"),
  student_male_variant: createCustomerDirectionalAssetSet("student_male_variant", "customer_student_male_variant"),
  office_male: createCustomerDirectionalAssetSet("office_male", "customer_office_male"),
  office_female: createCustomerDirectionalAssetSet("office_female", "customer_office_female"),
  trouble_sharp_auntie: createCustomerDirectionalAssetSet("trouble_sharp_auntie", "customer_trouble_sharp_auntie"),
  trouble_bulky_sleeve: createCustomerDirectionalAssetSet("trouble_bulky_sleeve", "customer_trouble_bulky_sleeve"),
  trouble_bargain_perm: createCustomerDirectionalAssetSet("trouble_bargain_perm", "customer_trouble_bargain_perm"),
  trouble_coin_bomber: createCustomerDirectionalAssetSet("trouble_coin_bomber", "customer_trouble_coin_bomber"),
  trouble_command_uncle: createCustomerDirectionalAssetSet("trouble_command_uncle", "customer_trouble_command_uncle"),
  trouble_drunk: createCustomerDirectionalAssetSet("trouble_drunk", "customer_trouble_drunk"),
  trouble_influencer: createCustomerDirectionalAssetSet("trouble_influencer", "customer_trouble_influencer"),
  trouble_mischief_kid: createCustomerDirectionalAssetSet("trouble_mischief_kid", "customer_trouble_mischief_kid"),
  trouble_return_refund: createCustomerDirectionalAssetSet("trouble_return_refund", "customer_trouble_return_refund"),
  trouble_sleazy_rose: createCustomerDirectionalAssetSet("trouble_sleazy_rose", "customer_trouble_sleazy_rose")
});

export const CUSTOMER_TYPE_ASSET_VARIANTS = deepFreeze({
  normal: ["normal_v2"],
  student: ["student_male", "student_female", "student_male_variant"],
  office_worker: ["office_male", "office_female"],
  hurried: ["office_male", "office_female", "normal_v2"],
  difficult: [
    "trouble_command_uncle",
    "trouble_bargain_perm",
    "trouble_bulky_sleeve",
    "trouble_sharp_auntie"
  ]
});

export const NUISANCE_CUSTOMER_ASSET_VARIANTS = deepFreeze({
  CUSTOMER_DONT_ORDER_ME: ["trouble_command_uncle"],
  CUSTOMER_DISCOUNT_APPEAL: ["trouble_bargain_perm"],
  CUSTOMER_EXTRA_BAG: ["trouble_bulky_sleeve"],
  CUSTOMER_BRAG_BULK: ["trouble_bulky_sleeve"],
  CUSTOMER_MICROWAVE_TROUBLE: ["trouble_bargain_perm"],
  CUSTOMER_COIN_BOMB: ["trouble_coin_bomber"],
  CUSTOMER_COMPLAINT_AUNT: ["trouble_sharp_auntie"],
  CUSTOMER_DRUNK: ["trouble_drunk"],
  CUSTOMER_INFLUENCER: ["trouble_influencer"],
  CUSTOMER_JAMMIN_RIOT: ["trouble_mischief_kid"],
  CUSTOMER_ROSE_FLIRT: ["trouble_sleazy_rose"],
  CUSTOMER_REFUND_VILLAIN: ["trouble_return_refund"]
});

export const NUISANCE_CUSTOMER_ASSET_VARIANT_IDS = Object.freeze(
  Array.from(
    new Set(
      Object.values(NUISANCE_CUSTOMER_ASSET_VARIANTS)
        .flat()
        .map((variantId) => String(variantId ?? "").trim())
        .filter(Boolean)
    )
  )
);

export const NUISANCE_CUSTOMER_PROFILE_IDS = Object.freeze(
  Object.keys(NUISANCE_CUSTOMER_ASSET_VARIANTS)
);

export function isNuisanceCustomerAssetVariantId(variantId) {
  const normalizedVariantId = String(variantId ?? "").trim();

  return NUISANCE_CUSTOMER_ASSET_VARIANT_IDS.includes(normalizedVariantId);
}

export function getNuisanceProfileIds() {
  return [...NUISANCE_CUSTOMER_PROFILE_IDS];
}

export function getNuisanceProfileIdForAssetVariantId(variantId) {
  const normalizedVariantId = String(variantId ?? "").trim();

  if (!normalizedVariantId) {
    return null;
  }

  return (
    NUISANCE_CUSTOMER_PROFILE_IDS.find((profileId) => {
      return (NUISANCE_CUSTOMER_ASSET_VARIANTS[profileId] ?? []).includes(
        normalizedVariantId
      );
    }) ?? null
  );
}

export function getNuisanceAssetVariantIdForProfile(profileId, seedSource = "") {
  const normalizedProfileId = String(profileId ?? "").trim();
  const variants = NUISANCE_CUSTOMER_ASSET_VARIANTS[normalizedProfileId] ?? [];

  if (variants.length === 0) {
    return null;
  }

  return variants[getStableIndex(`${normalizedProfileId}|${seedSource}`, variants.length)] ?? null;
}

// Backward-compatible alias for older CustomerSystem patches.
// Some patch files import getNuisanceVariantIdForProfile without the "Asset" segment.
export function getNuisanceVariantIdForProfile(profileId, seedSource = "") {
  return getNuisanceAssetVariantIdForProfile(profileId, seedSource);
}

function getStableIndex(seedSource, length) {
  const safeLength = Math.max(0, Number(length) || 0);

  if (safeLength <= 1) {
    return 0;
  }

  const seed = String(seedSource ?? "customer");
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % safeLength;
}

function getCustomerAssetSeed(customer = {}) {
  return [
    customer.customerId,
    customer.id,
    customer.typeId,
    customer.customerTypeId,
    customer.wantedProductId
  ].filter(Boolean).join("|") || "customer";
}

export function normalizeCustomerAssetDirection(direction = "down") {
  const normalizedDirection = String(direction ?? "down")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  return CUSTOMER_ASSET_DIRECTIONS.includes(normalizedDirection)
    ? normalizedDirection
    : "down";
}

export function getCustomerAssetDirection(customer = {}) {
  if (customer.direction) {
    return normalizeCustomerAssetDirection(customer.direction);
  }

  const status = customer.status ?? "";
  const currentZone = customer.currentZone ?? "";
  const targetZone = customer.targetZone ?? "";

  if (status === "leaving" || currentZone === "exit") {
    return "down_left";
  }

  if (currentZone === "counter") {
    return "down_left";
  }

  if (currentZone === "door") {
    return targetZone === "shelf" ? "up_right" : "down_right";
  }

  if (currentZone === "shelf" || String(currentZone).includes("shelf")) {
    return targetZone === "counter" ? "down_right" : "right";
  }

  return "down";
}

export function getCustomerAssetVariantId(customer = {}) {
  const explicitVariantId = String(
    customer.nuisanceAssetVariantId ?? customer.assetVariantId ?? customer.variantId ?? ""
  ).trim();

  if (explicitVariantId && CUSTOMER_ASSET_VARIANTS[explicitVariantId]) {
    return explicitVariantId;
  }

  const nuisanceProfileId = customer.nuisanceProfileId ?? null;
  const nuisanceVariants = nuisanceProfileId
    ? NUISANCE_CUSTOMER_ASSET_VARIANTS[nuisanceProfileId]
    : null;
  const typeId = customer.typeId ?? customer.customerTypeId ?? "normal";
  const typeVariants = CUSTOMER_TYPE_ASSET_VARIANTS[typeId] ?? CUSTOMER_TYPE_ASSET_VARIANTS.normal;
  const variants = nuisanceVariants?.length ? nuisanceVariants : typeVariants;
  const index = getStableIndex(getCustomerAssetSeed(customer), variants.length);

  return variants[index] ?? "normal_v2";
}

export function getCustomerAssetPath(customer = {}, direction = null) {
  const variantId = getCustomerAssetVariantId(customer);
  const directionId = normalizeCustomerAssetDirection(
    direction ?? getCustomerAssetDirection(customer)
  );
  const variantAssets = CUSTOMER_ASSET_VARIANTS[variantId] ?? CUSTOMER_ASSET_VARIANTS.normal_v2;

  return variantAssets?.[directionId] ?? variantAssets?.down ?? null;
}



export function getStaffAssetPath(staff = {}, direction = "down") {
  const variantId = String(staff.assetVariant ?? staff.variantId ?? staff.id ?? "staff_male_cashier").trim();
  const variantAssets = STAFF_ASSET_VARIANTS[variantId] ?? STAFF_ASSET_VARIANTS.staff_male_cashier;
  const normalizedDirection = normalizeCustomerAssetDirection(direction);

  return variantAssets?.[normalizedDirection] ?? variantAssets?.down ?? null;
}

export const ASSET_PATHS = deepFreeze({
  customers: {
    variants: CUSTOMER_ASSET_VARIANTS
  },
  staff: {
    variants: STAFF_ASSET_VARIANTS
  },
  objects: {
    displayStand: {
      full: {
        left: "./assets/objects/display_stand/display_stand_full_left.png",
        right: "./assets/objects/display_stand/display_stand_full_right.png"
      },
      half: {
        left: "./assets/objects/display_stand/display_stand_half_left.png",
        right: "./assets/objects/display_stand/display_stand_half_right.png"
      },
      empty: {
        left: "./assets/objects/display_stand/display_stand_empty_left.png",
        right: "./assets/objects/display_stand/display_stand_empty_right.png"
      }
    },
    freshShelf: {
      full: {
        left: "./assets/objects/fresh_shelf/fresh_shelf_full_left.png",
        right: "./assets/objects/fresh_shelf/fresh_shelf_full_right.png"
      },
      half: {
        left: "./assets/objects/fresh_shelf/fresh_shelf_half_left.png",
        right: "./assets/objects/fresh_shelf/fresh_shelf_half_right.png"
      },
      empty: {
        left: "./assets/objects/fresh_shelf/fresh_shelf_empty_left.png",
        right: "./assets/objects/fresh_shelf/fresh_shelf_empty_right.png"
      }
    },
    beverageFridge: {
      full: {
        left: "./assets/objects/beverage_fridge/beverage_fridge_full_left.png",
        right: "./assets/objects/beverage_fridge/beverage_fridge_full_right.png"
      },
      half: {
        left: "./assets/objects/beverage_fridge/beverage_fridge_half_left.png",
        right: "./assets/objects/beverage_fridge/beverage_fridge_half_right.png"
      },
      empty: {
        left: "./assets/objects/beverage_fridge/beverage_fridge_empty_left.png",
        right: "./assets/objects/beverage_fridge/beverage_fridge_empty_right.png"
      }
    },
    foodWarmer: {
      full: {
        left: "./assets/objects/food_warmer/food_warmer_full_left.png",
        right: "./assets/objects/food_warmer/food_warmer_full_right.png"
      },
      half: {
        left: "./assets/objects/food_warmer/food_warmer_left.png",
        right: "./assets/objects/food_warmer/food_warmer_right.png"
      },
      empty: {
        left: "./assets/objects/food_warmer/food_warmer_empty_left.png",
        right: "./assets/objects/food_warmer/food_warmer_empty_right.png"
      }
    },
    warehouse: {
      boxes: {
        basic: "./assets/images/warehouse/basic_box.png",
        basicOpen: "./assets/images/warehouse/basic_box_open.png",
        basicDouble: "./assets/images/warehouse/basic_box_double.png",
        arrive: "./assets/images/warehouse/arrive_box.png",
        drink: "./assets/images/warehouse/drink_box.png",
        ramen: "./assets/images/warehouse/ramen_box.png",
        lunch: "./assets/images/warehouse/lunch_box.png",
        snack: "./assets/images/warehouse/snack_box.png",
        refrigerated: "./assets/images/warehouse/refrigerated_box.png"
      }
    }
  },
  effects: {
    interaction: {
      clickSparkle: "./assets/effects/interaction/click_sparkle.png",
      fingerTap: "./assets/effects/interaction/interaction_finger_tap.png",
      glowRing: "./assets/effects/interaction/interactable_glow_ring.png"
    },
    loading: {
      dots: "./assets/effects/loading/loading_dots_3.png",
      dotsSpriteSheet: "./assets/effects/loading/loading_dots_spritesheet_3frames.png"
    },
    unlock: "./assets/effects/unlock/unlock_effect.png",
    upgrade: "./assets/effects/upgrade/upgrade_sparkle.png",
    constructionComplete: "./assets/effects/construction/construction_complete_effect.png"
  },
  ui: {
    buttons: {
      common: {
        base: {
          normal: "./assets/ui/buttons/common/base/ui_btn_base_normal.png",
          pressed: "./assets/ui/buttons/common/base/ui_btn_base_pressed.png",
          disabled: "./assets/ui/buttons/common/base/ui_btn_base_disabled.png"
        },
        large: {
          normal: "./assets/ui/buttons/common/large/ui_btn_large_normal.png",
          pressed: "./assets/ui/buttons/common/large/ui_btn_large_pressed.png",
          disabled: "./assets/ui/buttons/common/large/ui_btn_large_disabled.png"
        },
        small: {
          normal: "./assets/ui/buttons/common/small/ui_btn_small_normal.png",
          pressed: "./assets/ui/buttons/common/small/ui_btn_small_pressed.png",
          disabled: "./assets/ui/buttons/common/small/ui_btn_small_disabled.png"
        }
      },
      icon: {
        back: {
          normal: "./assets/ui/buttons/icon/ui_icon_back_normal.png",
          pressed: "./assets/ui/buttons/icon/ui_icon_back_pressed.png",
          disabled: "./assets/ui/buttons/icon/ui_icon_back_disabled.png"
        },
        cancel: {
          normal: "./assets/ui/buttons/icon/ui_icon_cancel_normal.png",
          pressed: "./assets/ui/buttons/icon/ui_icon_cancel_pressed.png",
          disabled: "./assets/ui/buttons/icon/ui_icon_cancel_disabled.png"
        },
        close: {
          normal: "./assets/ui/buttons/icon/ui_icon_close_normal.png",
          pressed: "./assets/ui/buttons/icon/ui_icon_close_pressed.png",
          disabled: "./assets/ui/buttons/icon/ui_icon_close_disabled.png"
        },
        confirm: {
          normal: "./assets/ui/buttons/icon/ui_icon_confirm_normal.png",
          pressed: "./assets/ui/buttons/icon/ui_icon_confirm_pressed.png",
          disabled: "./assets/ui/buttons/icon/ui_icon_confirm_disabled.png"
        },
        warning: {
          normal: "./assets/ui/buttons/icon/ui_icon_warning_normal.png",
          pressed: "./assets/ui/buttons/icon/ui_icon_warning_pressed.png",
          disabled: "./assets/ui/buttons/icon/ui_icon_warning_disabled.png"
        }
      },
      special: {
        continue: {
          normal: "./assets/ui/buttons/special/continue/ui_btn_continue_normal.png",
          pressed: "./assets/ui/buttons/special/continue/ui_btn_continue_pressed.png",
          disabled: "./assets/ui/buttons/special/continue/ui_btn_continue_disabled.png"
        },
        settings: {
          normal: "./assets/ui/buttons/special/settings/ui_icon_settings_normal.png",
          pressed: "./assets/ui/buttons/special/settings/ui_icon_settings_pressed.png",
          disabled: "./assets/ui/buttons/special/settings/ui_icon_settings_disabled.png"
        }
      }
    },
    textboxes: {
      normalCustomer: "./assets/ui/textbox/normalcustomer_npc_textbox.png",
      player: "./assets/ui/textbox/player_textbox.png",
      badCustomer: "./assets/ui/textbox/badcustomer_textbox.png"
    },
    components: {
      tabs: {
        normal: "./assets/ui/components/tabs/ui_tab_button_normal.png",
        pressed: "./assets/ui/components/tabs/ui_tab_button_pressed.png",
        selected: "./assets/ui/components/tabs/ui_tab_button_selected.png",
        disabled: "./assets/ui/components/tabs/ui_tab_button_disabled.png"
      },
      checkbox: {
        checked: "./assets/ui/components/checkbox/ui_checkbox_checked.png",
        checkedDisabled: "./assets/ui/components/checkbox/ui_checkbox_checked_disabled.png",
        unchecked: "./assets/ui/components/checkbox/ui_checkbox_unchecked.png",
        uncheckedDisabled: "./assets/ui/components/checkbox/ui_checkbox_unchecked_disabled.png"
      },
      icons: {
        shelfWarningYellow: "./assets/ui/icons/shelf_warning_yellow.png",
        shelfWarningRed: "./assets/ui/icons/shelf_warning_red.png"
      }
    }
  }
});

const OBJECT_TYPE_ALIASES = Object.freeze({
  displayStand: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
  display_stand: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
  "display-stand": STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
  stand: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
  shelf: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
  freshShelf: STOCK_VISUAL_OBJECT_TYPES.FRESH_SHELF,
  fresh_shelf: STOCK_VISUAL_OBJECT_TYPES.FRESH_SHELF,
  "fresh-shelf": STOCK_VISUAL_OBJECT_TYPES.FRESH_SHELF,
  beverageFridge: STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
  beverage_fridge: STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
  "beverage-fridge": STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
  fridge: STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
  foodWarmer: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
  food_warmer: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
  "food-warmer": STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
  warmer: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
  hotbar: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
  hoppang: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER
});

export const STOCK_VISUAL_OBJECTS = deepFreeze({
  displayStand: {
    objectType: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
    label: "display stand",
    defaultFacing: OBJECT_FACINGS.LEFT,
    assets: ASSET_PATHS.objects.displayStand
  },
  freshShelf: {
    objectType: STOCK_VISUAL_OBJECT_TYPES.FRESH_SHELF,
    label: "fresh shelf",
    defaultFacing: OBJECT_FACINGS.LEFT,
    assets: ASSET_PATHS.objects.freshShelf
  },
  beverageFridge: {
    objectType: STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
    label: "beverage fridge",
    defaultFacing: OBJECT_FACINGS.LEFT,
    assets: ASSET_PATHS.objects.beverageFridge
  },
  foodWarmer: {
    objectType: STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
    label: "food warmer",
    defaultFacing: OBJECT_FACINGS.RIGHT,
    assets: ASSET_PATHS.objects.foodWarmer
  }
});

export const WAREHOUSE_BOX_TYPES = Object.freeze({
  ARRIVE: "arrive",
  BASIC: "basic",
  BASIC_OPEN: "basicOpen",
  BASIC_DOUBLE: "basicDouble",
  DRINK: "drink",
  RAMEN: "ramen",
  LUNCH: "lunch",
  SNACK: "snack",
  REFRIGERATED: "refrigerated"
});

export const WAREHOUSE_BOX_ASSETS = deepFreeze({
  [WAREHOUSE_BOX_TYPES.ARRIVE]: ASSET_PATHS.objects.warehouse.boxes.arrive,
  [WAREHOUSE_BOX_TYPES.BASIC]: ASSET_PATHS.objects.warehouse.boxes.basic,
  [WAREHOUSE_BOX_TYPES.BASIC_OPEN]: ASSET_PATHS.objects.warehouse.boxes.basicOpen,
  [WAREHOUSE_BOX_TYPES.BASIC_DOUBLE]: ASSET_PATHS.objects.warehouse.boxes.basicDouble,
  [WAREHOUSE_BOX_TYPES.DRINK]: ASSET_PATHS.objects.warehouse.boxes.drink,
  [WAREHOUSE_BOX_TYPES.RAMEN]: ASSET_PATHS.objects.warehouse.boxes.ramen,
  [WAREHOUSE_BOX_TYPES.LUNCH]: ASSET_PATHS.objects.warehouse.boxes.lunch,
  [WAREHOUSE_BOX_TYPES.SNACK]: ASSET_PATHS.objects.warehouse.boxes.snack,
  [WAREHOUSE_BOX_TYPES.REFRIGERATED]: ASSET_PATHS.objects.warehouse.boxes.refrigerated
});

export function getWarehouseBoxAsset(boxType) {
  return WAREHOUSE_BOX_ASSETS[boxType] ?? WAREHOUSE_BOX_ASSETS[WAREHOUSE_BOX_TYPES.BASIC];
}

export function normalizeStockVisualState(state) {
  const value = String(state ?? "").trim();
  const allowedStates = Object.values(STOCK_VISUAL_STATES);

  return allowedStates.includes(value) ? value : null;
}

export function normalizeObjectVisualType(objectType) {
  return OBJECT_TYPE_ALIASES[objectType] ?? null;
}

export function normalizeObjectFacing(facing) {
  return facing === OBJECT_FACINGS.RIGHT
    ? OBJECT_FACINGS.RIGHT
    : OBJECT_FACINGS.LEFT;
}

export function normalizeUiButtonState(state) {
  const value = String(state ?? "").trim();
  const allowedStates = Object.values(UI_BUTTON_STATES);

  return allowedStates.includes(value) ? value : UI_BUTTON_STATES.NORMAL;
}

export function normalizeStockNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(0, numberValue);
}

export function normalizeCapacityNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return numberValue;
}

export function normalizeRatioThreshold(value, fallback) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, numberValue));
}

export function getStockFillRatio(stock, capacity) {
  const safeCapacity = normalizeCapacityNumber(capacity);

  if (safeCapacity <= 0) {
    return 0;
  }

  const safeStock = Math.min(normalizeStockNumber(stock), safeCapacity);

  return safeStock / safeCapacity;
}

export function getStockVisualState(stock, capacity, options = {}) {
  const emptyThreshold = normalizeRatioThreshold(options.emptyThreshold, 0);
  const fullThreshold = Math.max(
    emptyThreshold,
    normalizeRatioThreshold(options.fullThreshold, 0.7)
  );
  const ratio = getStockFillRatio(stock, capacity);

  if (ratio <= emptyThreshold) {
    return STOCK_VISUAL_STATES.EMPTY;
  }

  if (ratio >= fullThreshold) {
    return STOCK_VISUAL_STATES.FULL;
  }

  return STOCK_VISUAL_STATES.HALF;
}

export function getObjectVisualAsset(objectType, stock, capacity, options = {}) {
  const normalizedType = normalizeObjectVisualType(objectType);
  const objectConfig = normalizedType
    ? STOCK_VISUAL_OBJECTS[normalizedType]
    : null;

  if (!objectConfig) {
    return null;
  }

  const state = normalizeStockVisualState(options.state) ??
    getStockVisualState(stock, capacity, options);
  const facing = normalizeObjectFacing(options.facing ?? objectConfig.defaultFacing);
  const path = objectConfig.assets[state]?.[facing] ??
    objectConfig.assets[state]?.[objectConfig.defaultFacing] ??
    null;

  return {
    objectType: normalizedType,
    label: objectConfig.label,
    state,
    facing,
    stock: normalizeStockNumber(stock),
    capacity: normalizeCapacityNumber(capacity),
    ratio: getStockFillRatio(stock, capacity),
    path
  };
}

export function getDisplayStandVisualAsset(stock, capacity, options = {}) {
  return getObjectVisualAsset(
    STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
    stock,
    capacity,
    options
  );
}

export function getBeverageFridgeVisualAsset(stock, capacity, options = {}) {
  return getObjectVisualAsset(
    STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
    stock,
    capacity,
    options
  );
}

export function getFoodWarmerVisualAsset(stock, capacity, options = {}) {
  return getObjectVisualAsset(
    STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER,
    stock,
    capacity,
    options
  );
}

export function getUiButtonAsset(group, variant, state = UI_BUTTON_STATES.NORMAL) {
  const normalizedState = normalizeUiButtonState(state);
  const groupAssets = ASSET_PATHS.ui.buttons[group] ?? null;
  const variantAssets = groupAssets?.[variant] ?? null;

  return variantAssets?.[normalizedState] ?? null;
}

export function collectAssetPaths(assetTree = ASSET_PATHS) {
  const paths = [];

  function visit(value) {
    if (!value) {
      return;
    }

    if (typeof value === "string") {
      paths.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  }

  visit(assetTree);

  return [...new Set(paths)];
}

export const PRELOAD_ASSET_PATHS = Object.freeze(collectAssetPaths());

export function preloadImage(path, options = {}) {
  const src = String(path ?? "").trim();

  if (!src) {
    return Promise.resolve({
      path: src,
      ok: false,
      status: "skipped",
      reason: "empty_path"
    });
  }

  if (typeof Image === "undefined") {
    return Promise.resolve({
      path: src,
      ok: false,
      status: "skipped",
      reason: "image_api_unavailable"
    });
  }

  return new Promise((resolve) => {
    const image = new Image();

    if (options.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }

    image.onload = () => {
      resolve({
        path: src,
        ok: true,
        status: "loaded",
        image
      });
    };

    image.onerror = () => {
      resolve({
        path: src,
        ok: false,
        status: "failed"
      });
    };

    image.src = src;
  });
}

export async function preloadImages(paths = PRELOAD_ASSET_PATHS, options = {}) {
  const uniquePaths = [...new Set(
    (Array.isArray(paths) ? paths : [paths]).filter(Boolean)
  )];
  const results = await Promise.all(
    uniquePaths.map((path) => preloadImage(path, options))
  );

  return {
    total: uniquePaths.length,
    loaded: results.filter((result) => result.status === "loaded").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results
  };
}

export function preloadGameAssets(options = {}) {
  return preloadImages(PRELOAD_ASSET_PATHS, options);
}
