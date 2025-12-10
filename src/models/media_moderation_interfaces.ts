export interface ImageModerationResult {
  status: string;
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  nudity: {
    sexual_activity: number;
    sexual_display: number;
    erotica: number;
    very_suggestive: number;
    suggestive: number;
    mildly_suggestive: number;
    suggestive_classes: {
      bikini: number;
      cleavage: number;
      cleavage_categories: {
        very_revealing: number;
        revealing: number;
        none: number;
      };
      lingerie: number;
      male_chest: number;
      male_chest_categories: {
        very_revealing: number;
        revealing: number;
        slightly_revealing: number;
        none: number;
      };
      male_underwear: number;
      miniskirt: number;
      minishort: number;
      nudity_art: number;
      schematic: number;
      sextoy: number;
      suggestive_focus: number;
      suggestive_pose: number;
      swimwear_male: number;
      swimwear_one_piece: number;
      visibly_undressed: number;
      other: number;
    };
    none: number;
    context: {
      sea_lake_pool: number;
      outdoor_other: number;
      indoor_other: number;
    };
  };
  type: {
    photo: number;
    illustration: number;
    ai_generated: number;
  };
  offensive: {
    nazi: number;
    asian_swastika: number;
    confederate: number;
    supremacist: number;
    terrorist: number;
    middle_finger: number;
  };
  faces: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    attributes: {
      age: {
        minor: number;
      };
    };
  }>;
  artificial_faces: Array<any>;
  "people-counting": {
    "0": number;
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5+": number;
  };
  text: {
    profanity: Array<any>;
    personal: Array<any>;
    link: Array<any>;
    social: Array<any>;
    extremism: Array<any>;
    medical: Array<any>;
    drug: Array<any>;
    weapon: Array<any>;
    "content-trade": Array<any>;
    "money-transaction": Array<any>;
    spam: Array<any>;
    violence: Array<any>;
    "self-harm": Array<any>;
    has_artificial: number;
    has_natural: number;
  };
  qr: {
    personal: Array<any>;
    link: Array<any>;
    social: Array<any>;
    spam: Array<any>;
    profanity: Array<any>;
    blacklist: Array<any>;
  };
  "self-harm": {
    prob: number;
    type: {
      real: number;
      fake: number;
      animated: number;
    };
  };
  media: {
    id: string;
    uri: string;
  };
}

export interface VideoModerationResult {
  status: string;
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  summary: {
    action: string;
    reject_prob: number;
    reject_reason: Array<{
      text: string;
    }>;
  };
  data: {
    frames: Array<any>;
  };
  workflow: {
    id: string;
  };
}
