// Auto-generated asset path helper for 오늘도 정상영업
// Generated from cleaned asset package v1.0.

export const ASSET_PATHS = {
  objects: {
    displayStand: {
      full: {
        left: './assets/objects/display_stand/display_stand_full_left.png',
        right: './assets/objects/display_stand/display_stand_full_right.png',
      },
      half: {
        left: './assets/objects/display_stand/display_stand_half_left.png',
        right: './assets/objects/display_stand/display_stand_half_right.png',
      },
      empty: {
        left: './assets/objects/display_stand/display_stand_empty_left.png',
        right: './assets/objects/display_stand/display_stand_empty_right.png',
      },
    },
    beverageFridge: {
      full: {
        left: './assets/objects/beverage_fridge/beverage_fridge_full_left.png',
        right: './assets/objects/beverage_fridge/beverage_fridge_full_right.png',
      },
      half: {
        left: './assets/objects/beverage_fridge/beverage_fridge_half_left.png',
        right: './assets/objects/beverage_fridge/beverage_fridge_half_right.png',
      },
      empty: {
        left: './assets/objects/beverage_fridge/beverage_fridge_empty_left.png',
        right: './assets/objects/beverage_fridge/beverage_fridge_empty_right.png',
      },
    },
  },
  effects: {
    interaction: {
      clickSparkle: './assets/effects/interaction/click_sparkle.png',
      fingerTap: './assets/effects/interaction/interaction_finger_tap.png',
      glowRing: './assets/effects/interaction/interactable_glow_ring.png',
    },
    loading: {
      dots: './assets/effects/loading/loading_dots_3.png',
      dotsSpriteSheet: './assets/effects/loading/loading_dots_spritesheet_3frames.png',
    },
    unlock: './assets/effects/unlock/unlock_effect.png',
    upgrade: './assets/effects/upgrade/upgrade_sparkle.png',
    constructionComplete: './assets/effects/construction/construction_complete_effect.png',
  },
};

export function getStockVisualState(stock, capacity) {
  if (!capacity || stock <= 0) return 'empty';
  const ratio = stock / capacity;
  if (ratio >= 0.7) return 'full';
  return 'half';
}
