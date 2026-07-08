import type { Prisma } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";

type GuideStep = { title: string; body: string };

type GuideSections = {
  before: GuideStep[];
  during: GuideStep[];
  after: GuideStep[];
};

type TopicSeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
};

type GuideSeed = {
  slug: string;
  topicSlug: string;
  title: string;
  summary: string;
  sections: GuideSections;
  sourceName: string;
  sourceUrl: string;
  sortOrder: number;
  /** Case-insensitive keywords matched against HazardCategory names at seed time. */
  categoryKeywords: string[];
};

const DISCLAIMER =
  "ALRT shares safety information and does not issue emergency instructions. In a life-threatening emergency call 000.";

const sourceNoteFor = (sourceName: string, sourceUrl: string): string =>
  `This guide summarises publicly available safety information from ${sourceName} (${sourceUrl}). ${DISCLAIMER}`;

const topics: TopicSeed[] = [
  {
    slug: "severe-weather-flood",
    name: "Severe Weather & Flood",
    description: "Storms, cyclones, flash flooding and riverine floods.",
    icon: "cloud",
    color: "#4A90D9",
    sortOrder: 0,
  },
  {
    slug: "bushfire-heat",
    name: "Bushfire & Heat",
    description: "Bushfire seasons, fire danger ratings and extreme heat.",
    icon: "flame",
    color: "#F26522",
    sortOrder: 1,
  },
  {
    slug: "personal-safety",
    name: "Personal Safety",
    description: "Staying safe at home, on the street and in crowds.",
    icon: "shield",
    color: "#E0475B",
    sortOrder: 2,
  },
  {
    slug: "earthquake-tsunami",
    name: "Earthquake & Tsunami",
    description: "Earth tremors, earthquakes and tsunami warnings.",
    icon: "waves",
    color: "#8E6CD0",
    sortOrder: 3,
  },
  {
    slug: "power-utilities",
    name: "Power & Utilities",
    description: "Power outages, gas leaks and water supply issues.",
    icon: "bolt",
    color: "#E8B931",
    sortOrder: 4,
  },
  {
    slug: "travel-safety",
    name: "Travel Safety",
    description: "Travelling safely in Australia and overseas.",
    icon: "globe",
    color: "#3BA273",
    sortOrder: 5,
  },
];

const guides: GuideSeed[] = [
  // --- Severe Weather & Flood ------------------------------------------------
  {
    slug: "flood-being-prepared",
    topicSlug: "severe-weather-flood",
    title: "Flood: being prepared",
    summary:
      "Suggestions from the NSW SES for getting your home and family ready before flooding occurs.",
    sortOrder: 0,
    sourceName: "NSW SES",
    sourceUrl: "https://www.ses.nsw.gov.au",
    categoryKeywords: ["flood"],
    sections: {
      before: [
        {
          title: "Know your flood risk",
          body: "The NSW SES suggests finding out whether your home, workplace or school is in a flood-prone area. Local council flood maps can help you understand how water has behaved there in the past.",
        },
        {
          title: "Plan where you could go",
          body: "Consider deciding in advance where you might stay if you needed to leave, such as with family or friends on higher ground. Authorities recommend planning more than one route out of your area.",
        },
        {
          title: "Prepare an emergency kit",
          body: "Consider keeping a kit with a torch, radio, batteries, medications and copies of important documents in a waterproof bag. The SES suggests checking it at the start of each storm season.",
        },
        {
          title: "Think about insurance and valuables",
          body: "Authorities recommend reviewing whether your insurance covers flood damage. Consider storing valuables and keepsakes above likely flood levels.",
        },
      ],
      during: [
        {
          title: "Stay across warnings",
          body: "The SES suggests monitoring official warnings from the Bureau of Meteorology and your state emergency service. Conditions can change quickly during a flood event.",
        },
        {
          title: "Avoid floodwater",
          body: "Authorities consistently advise never driving, riding or walking through floodwater. Even shallow, slow-moving water can hide hazards and carry vehicles away.",
        },
        {
          title: "Move early if advised",
          body: "If evacuation is recommended for your area, the SES suggests leaving early rather than waiting. Roads can close quickly once water starts rising.",
        },
        {
          title: "Help others stay informed",
          body: "Consider checking on neighbours, especially older people or anyone who may not have seen the warnings.",
        },
      ],
      after: [
        {
          title: "Wait for the all-clear",
          body: "Authorities recommend returning home only when officials say it is safe. Floodwater can remain dangerous even after rain has stopped.",
        },
        {
          title: "Be cautious around damage",
          body: "The SES suggests treating all flood-affected electrical equipment and structures as hazardous until they are checked. Wear protective clothing during clean-up if you can.",
        },
        {
          title: "Document losses",
          body: "Consider photographing damage before cleaning up, which can help with insurance claims and recovery assistance.",
        },
      ],
    },
  },
  {
    slug: "flash-flooding",
    topicSlug: "severe-weather-flood",
    title: "Flash flooding",
    summary:
      "How flash floods develop quickly and what authorities suggest doing when they threaten.",
    sortOrder: 1,
    sourceName: "NSW SES",
    sourceUrl: "https://www.ses.nsw.gov.au",
    categoryKeywords: ["flood"],
    sections: {
      before: [
        {
          title: "Understand the speed of flash floods",
          body: "Flash flooding can develop within minutes of intense rain, often with little warning. The SES suggests knowing whether your area drains poorly or sits near creeks and stormwater channels.",
        },
        {
          title: "Identify higher ground nearby",
          body: "Consider noting places near your home, work and regular routes where you could quickly move above rising water.",
        },
        {
          title: "Keep drains clear",
          body: "Authorities suggest keeping gutters, downpipes and nearby drains clear of leaves and debris so water can move away from your property.",
        },
      ],
      during: [
        {
          title: "Move to higher ground early",
          body: "If water begins rising around you, authorities suggest moving to higher ground straight away rather than waiting to see how bad it gets.",
        },
        {
          title: "Stay out of drains and culverts",
          body: "The SES advises staying well away from stormwater drains, culverts and causeways during heavy rain. Water in these channels moves faster than it appears.",
        },
        {
          title: "Never drive into water",
          body: "Authorities consistently recommend turning around rather than driving through water over a road. Depth and road damage are impossible to judge from behind the wheel.",
        },
        {
          title: "Call for help if trapped",
          body: "If you become trapped by rising water and it is life-threatening, call 000. For emergency help in floods and storms, the SES can be reached on 132 500.",
        },
      ],
      after: [
        {
          title: "Expect hidden damage",
          body: "Flash floods can undermine roads and footpaths. Authorities suggest watching for washed-out surfaces and debris when moving around afterwards.",
        },
        {
          title: "Avoid remaining water",
          body: "Consider staying out of any remaining floodwater, which may be contaminated with sewage or chemicals.",
        },
        {
          title: "Report hazards",
          body: "The SES suggests reporting fallen trees, damaged roads and other hazards to the relevant authority so they can be made safe.",
        },
      ],
    },
  },
  {
    slug: "driving-near-floodwater",
    topicSlug: "severe-weather-flood",
    title: "Driving and floodwater",
    summary:
      "Why authorities say to never drive through floodwater, and what to consider if you encounter it.",
    sortOrder: 2,
    sourceName: "NSW SES",
    sourceUrl: "https://www.ses.nsw.gov.au",
    categoryKeywords: ["flood"],
    sections: {
      before: [
        {
          title: "Plan around closures",
          body: "Before driving in wet weather, the SES suggests checking live traffic and road closure information for your route. Consider delaying non-essential trips during flood warnings.",
        },
        {
          title: "Know the risk to vehicles",
          body: "Authorities note that as little as 15 centimetres of moving water can float a small car. Most flood deaths in Australia involve vehicles entering floodwater.",
        },
        {
          title: "Keep your fuel up",
          body: "Consider keeping your tank at least half full during storm season in case you need to take longer alternative routes.",
        },
      ],
      during: [
        {
          title: "If it's flooded, forget it",
          body: "The SES uses the message \"If it's flooded, forget it\". Authorities recommend never driving into water covering a road, no matter how shallow it looks.",
        },
        {
          title: "Turn around safely",
          body: "If you meet water over the road, consider turning around and finding another route, even if it adds significant time.",
        },
        {
          title: "If your car stalls in water",
          body: "If your vehicle is caught in rising water and you are in danger, authorities advise leaving the vehicle and moving to higher ground if it is safe to do so, and calling 000 if your life is at risk.",
        },
      ],
      after: [
        {
          title: "Have flood-affected cars checked",
          body: "Authorities suggest not starting a vehicle that has been in floodwater until it has been inspected, as water can damage engines and electrical systems.",
        },
        {
          title: "Watch for road damage",
          body: "Roads that were underwater may be scoured or unstable. Consider driving to the conditions and obeying any closure signage that remains.",
        },
        {
          title: "Check your route home",
          body: "The SES suggests confirming roads have reopened before travelling after a flood, as closures can remain in place during clean-up.",
        },
      ],
    },
  },
  {
    slug: "severe-storm",
    topicSlug: "severe-weather-flood",
    title: "Severe storms",
    summary:
      "Preparing for damaging winds, large hail and heavy rain, based on Bureau of Meteorology guidance.",
    sortOrder: 3,
    sourceName: "Bureau of Meteorology",
    sourceUrl: "http://www.bom.gov.au",
    categoryKeywords: ["storm", "cyclone", "weather"],
    sections: {
      before: [
        {
          title: "Maintain your property",
          body: "Authorities suggest trimming overhanging branches, clearing gutters and securing loose outdoor items before storm season. These are common causes of storm damage.",
        },
        {
          title: "Check warnings daily in season",
          body: "The Bureau of Meteorology issues severe thunderstorm warnings when damaging conditions are likely. Consider checking the forecast when storms are possible in your area.",
        },
        {
          title: "Plan for outages",
          body: "Severe storms often cut power. Consider keeping torches, charged power banks and a battery radio where you can find them in the dark.",
        },
      ],
      during: [
        {
          title: "Shelter indoors",
          body: "Authorities recommend staying inside, away from windows, during a severe storm. Consider unplugging sensitive electrical equipment if it is safe to do so.",
        },
        {
          title: "Avoid driving if possible",
          body: "The BoM suggests delaying travel during severe storms, and if you must drive, pulling over safely away from trees and powerlines during the worst conditions.",
        },
        {
          title: "Stay clear of fallen powerlines",
          body: "Authorities advise treating all fallen powerlines as live and staying at least eight metres away. Report them to your electricity provider or 000 if they pose immediate danger.",
        },
      ],
      after: [
        {
          title: "Check for damage carefully",
          body: "Consider checking your property for damage while watching for hazards like broken glass, damaged roofing and fallen branches.",
        },
        {
          title: "Request help for storm damage",
          body: "For emergency assistance with storm damage such as fallen trees on buildings, the SES can be contacted on 132 500.",
        },
        {
          title: "Be patient with restoration",
          body: "Power restoration can take time after widespread storms. Authorities suggest keeping fridges and freezers closed to preserve food during outages.",
        },
      ],
    },
  },
  {
    slug: "cyclone",
    topicSlug: "severe-weather-flood",
    title: "Tropical cyclones",
    summary:
      "What QFES and the Bureau suggest before, during and after a tropical cyclone.",
    sortOrder: 4,
    sourceName: "Queensland Fire and Emergency Services (QFES)",
    sourceUrl: "https://www.fire.qld.gov.au",
    categoryKeywords: ["storm", "cyclone", "weather"],
    sections: {
      before: [
        {
          title: "Prepare your home early",
          body: "QFES suggests preparing well before cyclone season: checking the roof, trimming trees and knowing how to secure or store loose items quickly.",
        },
        {
          title: "Identify your shelter options",
          body: "Consider identifying the strongest room in your home, usually the smallest room away from windows, and finding out where public cyclone shelters are located.",
        },
        {
          title: "Stock supplies",
          body: "Authorities recommend keeping enough food, water and medication for at least three days, along with cash, fuel and a battery radio, as services can be cut for extended periods.",
        },
        {
          title: "Understand the warning stages",
          body: "The Bureau of Meteorology issues Cyclone Watch and Cyclone Warning messages. Consider learning what each stage means so you can act with enough time.",
        },
      ],
      during: [
        {
          title: "Shelter in the strongest room",
          body: "Authorities suggest sheltering in the strongest part of the building, away from windows, with your emergency kit close by.",
        },
        {
          title: "Beware the calm eye",
          body: "QFES notes that the calm eye of a cyclone can pass directly overhead. Authorities advise staying sheltered until officials confirm the cyclone has passed, as winds return suddenly from the opposite direction.",
        },
        {
          title: "Stay informed",
          body: "Consider listening to a battery radio for official updates, as power and mobile networks may fail during the storm.",
        },
      ],
      after: [
        {
          title: "Wait for official all-clear",
          body: "Authorities recommend staying indoors until officials advise it is safe. Hazards like fallen powerlines, debris and floodwater are common after a cyclone.",
        },
        {
          title: "Check on others",
          body: "Consider checking on neighbours once it is safe, particularly anyone who sheltered alone.",
        },
        {
          title: "Avoid sightseeing",
          body: "QFES suggests staying off the roads after a cyclone so emergency services can work, and avoiding damaged areas.",
        },
      ],
    },
  },

  // --- Bushfire & Heat --------------------------------------------------------
  {
    slug: "bushfire-being-prepared",
    topicSlug: "bushfire-heat",
    title: "Bushfire: being prepared",
    summary:
      "Key ideas from the NSW RFS Bush Fire Survival Plan for preparing your home and family.",
    sortOrder: 0,
    sourceName: "NSW Rural Fire Service (Bush Fire Survival Plan)",
    sourceUrl: "https://www.rfs.nsw.gov.au",
    categoryKeywords: ["fire", "bushfire"],
    sections: {
      before: [
        {
          title: "Decide early: stay or go",
          body: "The RFS suggests deciding in advance whether your plan is to leave early or stay and defend a well-prepared property. Leaving early is the safest option for most people.",
        },
        {
          title: "Make a written plan",
          body: "The RFS Bush Fire Survival Plan suggests writing down what you will do, where you will go and what you will take, and discussing it with everyone in your household.",
        },
        {
          title: "Prepare your property",
          body: "Authorities recommend keeping grass short, clearing gutters and moving flammable items away from the house before and during the fire season.",
        },
        {
          title: "Know your fire danger ratings",
          body: "Consider learning what each Fire Danger Rating means for your plan. On Catastrophic days, the RFS advises that leaving early is the only safe option.",
        },
      ],
      during: [
        {
          title: "Act on warnings early",
          body: "Authorities suggest monitoring official warnings through the RFS website, the Hazards Near Me app and local radio, and acting on your plan before conditions deteriorate.",
        },
        {
          title: "Leave early if that is your plan",
          body: "The RFS advises that leaving early, well before a fire arrives, is far safer than leaving at the last moment when roads may be cut or smoke-affected.",
        },
        {
          title: "Wear protective clothing",
          body: "If you are near a fire, authorities recommend covering up with long sleeves, sturdy shoes and natural-fibre clothing to protect against radiant heat.",
        },
        {
          title: "Stay informed if trapped",
          body: "If a fire threatens and you cannot leave, authorities suggest sheltering in a cleared area or a building away from the fire front, and calling 000 if your life is at risk.",
        },
      ],
      after: [
        {
          title: "Return only when safe",
          body: "Authorities recommend waiting for official advice before returning to a fire-affected area. Trees, powerlines and buildings can remain dangerous for days.",
        },
        {
          title: "Check your property cautiously",
          body: "Consider checking for smouldering embers in roof spaces, under decks and in garden beds, and watch for hazards like damaged structures.",
        },
        {
          title: "Look after yourself",
          body: "Recovery from a bushfire takes time. Consider reaching out to recovery services and support lines if you or your family are struggling afterwards.",
        },
      ],
    },
  },
  {
    slug: "bushfire-during",
    topicSlug: "bushfire-heat",
    title: "Bushfire: during a fire",
    summary:
      "What authorities suggest when a bushfire is burning near you, based on RFS guidance.",
    sortOrder: 1,
    sourceName: "NSW Rural Fire Service",
    sourceUrl: "https://www.rfs.nsw.gov.au",
    categoryKeywords: ["fire", "bushfire"],
    sections: {
      before: [
        {
          title: "Understand warning levels",
          body: "The RFS uses three warning levels: Advice, Watch and Act, and Emergency Warning. Consider learning what each asks of you before you ever need them.",
        },
        {
          title: "Keep information sources ready",
          body: "Authorities suggest having several ways to receive warnings: the Hazards Near Me app, the RFS website, local ABC radio and the Bush Fire Information Line (1800 679 737).",
        },
        {
          title: "Ready your kit and vehicle",
          body: "On high fire danger days, consider keeping your emergency kit accessible and your car fuelled and facing the direction of escape.",
        },
      ],
      during: [
        {
          title: "Follow your plan",
          body: "The RFS suggests putting your Bush Fire Survival Plan into action as soon as you become aware of fire in your area, rather than waiting to see what happens.",
        },
        {
          title: "If leaving, go early",
          body: "Authorities advise that late evacuation is deadly. If your plan is to leave, leaving early gives you the best chance of avoiding smoke, embers and blocked roads.",
        },
        {
          title: "Protect against radiant heat",
          body: "Radiant heat is the biggest killer in a bushfire. Authorities recommend putting solid barriers, such as buildings or embankments, between you and the fire front.",
        },
        {
          title: "In a vehicle near fire",
          body: "If caught in a vehicle, authorities suggest parking in a cleared area away from vegetation, closing vents and windows, and staying low inside the car until the front passes.",
        },
      ],
      after: [
        {
          title: "Stay alert for new fires",
          body: "Embers can start new fires hours after the main front passes. Authorities suggest continuing to monitor your surroundings and official warnings.",
        },
        {
          title: "Check for spot fires",
          body: "If you defended a property, the RFS suggests patrolling for spot fires in roof cavities, gardens and woodpiles for several hours afterwards.",
        },
        {
          title: "Let people know you are safe",
          body: "Consider contacting family and friends when it is safe, and registering with Register.Find.Reunite if the Red Cross activates it for the event.",
        },
      ],
    },
  },
  {
    slug: "bushfire-after",
    topicSlug: "bushfire-heat",
    title: "Bushfire: after a fire",
    summary:
      "Returning home and recovering after a bushfire, based on RFS and recovery agency guidance.",
    sortOrder: 2,
    sourceName: "NSW Rural Fire Service",
    sourceUrl: "https://www.rfs.nsw.gov.au",
    categoryKeywords: ["fire", "bushfire"],
    sections: {
      before: [
        {
          title: "Wait for clearance",
          body: "Authorities recommend not returning to a fireground until officials confirm it is safe. Access may be restricted while crews deal with hazards.",
        },
        {
          title: "Prepare for what you may find",
          body: "Consider preparing yourself and family members, especially children, for the possibility of significant damage before you return.",
        },
        {
          title: "Gather protective gear",
          body: "Authorities suggest wearing sturdy boots, gloves and a P2 mask when first inspecting fire-damaged property, as ash can contain hazardous materials.",
        },
      ],
      during: [
        {
          title: "Inspect with caution",
          body: "Fire-damaged trees, buildings and water tanks can fail without warning. Authorities recommend keeping clear of anything that looks unstable.",
        },
        {
          title: "Treat ash and debris as hazardous",
          body: "Ash from burnt buildings may contain asbestos and chemicals. Authorities suggest avoiding disturbing debris until it has been assessed.",
        },
        {
          title: "Check utilities before use",
          body: "Consider having electricity, gas and water systems inspected before reconnecting them, and assume tank water may be contaminated by ash or fire retardant.",
        },
      ],
      after: [
        {
          title: "Document and report",
          body: "Consider photographing all damage before clean-up and contacting your insurer early. Many insurers have disaster response teams for major fires.",
        },
        {
          title: "Access recovery support",
          body: "Recovery centres, charities and government disaster payments may be available after major fires. Authorities suggest registering with recovery services even if your needs seem small.",
        },
        {
          title: "Take care of wellbeing",
          body: "Reactions to disaster can appear weeks or months later. Consider talking with your GP or support lines such as Lifeline (13 11 14) if you notice ongoing distress.",
        },
      ],
    },
  },
  {
    slug: "heatwave",
    topicSlug: "bushfire-heat",
    title: "Heatwaves",
    summary:
      "Coping with extreme heat, based on Bureau of Meteorology heatwave guidance.",
    sortOrder: 3,
    sourceName: "Bureau of Meteorology",
    sourceUrl: "http://www.bom.gov.au",
    categoryKeywords: ["heat"],
    sections: {
      before: [
        {
          title: "Watch the heatwave forecast",
          body: "The Bureau of Meteorology publishes a heatwave service showing the severity of upcoming heat. Consider checking it during summer, especially for severe or extreme heatwave forecasts.",
        },
        {
          title: "Plan cool places",
          body: "Consider identifying the coolest room in your home and public air-conditioned spaces nearby, such as libraries and shopping centres.",
        },
        {
          title: "Check on vulnerable people",
          body: "Older people, babies and people with chronic illness are most at risk in heat. Authorities suggest planning to check on vulnerable neighbours and relatives during heatwaves.",
        },
      ],
      during: [
        {
          title: "Stay hydrated",
          body: "Health authorities suggest drinking water regularly through the day, even if you do not feel thirsty, and limiting alcohol and caffeine.",
        },
        {
          title: "Avoid the hottest hours",
          body: "Consider staying indoors or in shade during the hottest part of the day, and rescheduling strenuous activity to early morning or evening.",
        },
        {
          title: "Keep your home cooler",
          body: "Authorities suggest closing curtains and blinds during the day, using fans or air-conditioning if available, and opening the house up when it cools in the evening.",
        },
        {
          title: "Never leave people or pets in cars",
          body: "Temperatures inside parked cars can double within minutes. Authorities advise never leaving children, adults or animals in a parked vehicle.",
        },
      ],
      after: [
        {
          title: "Watch for heat illness",
          body: "Symptoms like dizziness, nausea, headache and confusion can indicate heat exhaustion or heatstroke. Heatstroke is a medical emergency — call 000 if someone becomes confused or collapses.",
        },
        {
          title: "Keep checking on others",
          body: "Heat effects can continue after the peak passes. Consider checking again on anyone vulnerable in the days following a heatwave.",
        },
        {
          title: "Restock and review",
          body: "Consider replacing any supplies used and noting what worked, since heatwaves are Australia's deadliest natural hazard and tend to recur each summer.",
        },
      ],
    },
  },

  // --- Personal Safety --------------------------------------------------------
  {
    slug: "home-security",
    topicSlug: "personal-safety",
    title: "Home security basics",
    summary:
      "Practical suggestions for making your home a less attractive target.",
    sortOrder: 0,
    sourceName: "Australian Red Cross",
    sourceUrl: "https://www.redcross.org.au",
    categoryKeywords: ["security", "crime"],
    sections: {
      before: [
        {
          title: "Secure entry points",
          body: "Police services suggest fitting quality locks to doors and windows and using them consistently, including when you are home.",
        },
        {
          title: "Make the house look occupied",
          body: "Consider using timers on lights, pausing deliveries when away, and asking a neighbour to clear your mailbox during holidays.",
        },
        {
          title: "Record valuables",
          body: "Authorities suggest photographing valuables and recording serial numbers, which helps police and insurers if property is stolen.",
        },
        {
          title: "Know your neighbours",
          body: "Connected neighbourhoods tend to be safer ones. Consider joining or starting a Neighbourhood Watch-style group in your street.",
        },
      ],
      during: [
        {
          title: "If you hear an intruder",
          body: "Authorities generally suggest not confronting an intruder. If safe, move to a secure room with your phone and call 000.",
        },
        {
          title: "If you arrive home to signs of a break-in",
          body: "Police suggest not entering if you see signs of forced entry, as an offender may still be inside. Consider calling police from a safe location.",
        },
        {
          title: "Trust your instincts",
          body: "If someone at your door makes you uncomfortable, you are not obliged to open it. Consider speaking through the closed door and verifying identification of unexpected callers.",
        },
      ],
      after: [
        {
          title: "Report to police",
          body: "Report break-ins to police via 131 444 (or 000 if the offender may still be nearby). A police event number is usually needed for insurance claims.",
        },
        {
          title: "Preserve the scene",
          body: "Consider avoiding touching or cleaning up until police advise otherwise, as evidence may assist the investigation.",
        },
        {
          title: "Review and repair",
          body: "After an incident, consider repairing damage promptly and reviewing what could be strengthened, such as locks, lighting or an alarm.",
        },
      ],
    },
  },
  {
    slug: "walking-alone-at-night",
    topicSlug: "personal-safety",
    title: "Walking alone at night",
    summary:
      "Suggestions for staying aware and reducing risk when walking after dark.",
    sortOrder: 1,
    sourceName: "Australian Red Cross",
    sourceUrl: "https://www.redcross.org.au",
    categoryKeywords: ["security", "crime"],
    sections: {
      before: [
        {
          title: "Plan your route",
          body: "Consider choosing well-lit, busier routes even if they take longer, and letting someone know where you are going and when you expect to arrive.",
        },
        {
          title: "Keep your phone charged",
          body: "Authorities suggest heading out with a charged phone and, where available, sharing your live location with someone you trust.",
        },
        {
          title: "Consider your transport options",
          body: "If you will be out late, consider planning how you will get home in advance, such as booking transport rather than deciding on the street.",
        },
      ],
      during: [
        {
          title: "Stay aware of surroundings",
          body: "Consider keeping headphones low or out and your head up so you can see and hear what is happening around you.",
        },
        {
          title: "Project confidence",
          body: "Safety educators suggest walking purposefully and keeping to open, visible areas, avoiding shortcuts through parks, laneways and car parks at night.",
        },
        {
          title: "If you feel followed",
          body: "Consider crossing the street, changing direction, or entering an open business or well-lit populated area. If you believe you are in danger, call 000.",
        },
        {
          title: "Keep valuables out of sight",
          body: "Consider keeping phones, jewellery and cash out of easy view, and carrying bags closed and towards the building side of the footpath.",
        },
      ],
      after: [
        {
          title: "Check in",
          body: "Consider messaging your contact once you arrive, so they know you are safe and can raise the alarm if plans change.",
        },
        {
          title: "Report incidents",
          body: "If something happened or nearly happened, consider reporting it to police on 131 444. Reports help police identify patterns even when no offence is completed.",
        },
        {
          title: "Adjust your routine",
          body: "If a route or time regularly feels unsafe, consider varying it. Your comfort is a useful signal worth acting on.",
        },
      ],
    },
  },
  {
    slug: "crowded-events-civil-unrest",
    topicSlug: "personal-safety",
    title: "Crowded events & civil unrest",
    summary:
      "Staying safe in large crowds and around protests or unrest.",
    sortOrder: 2,
    sourceName: "Australian Red Cross",
    sourceUrl: "https://www.redcross.org.au",
    categoryKeywords: ["security", "crime"],
    sections: {
      before: [
        {
          title: "Know the venue",
          body: "Before large events, consider noting exits, first-aid points and meeting spots. Authorities suggest agreeing on a reunion point with your group in case you are separated.",
        },
        {
          title: "Check for planned disruptions",
          body: "Consider checking news and transport alerts for planned protests or closures along your route, and allowing extra travel time.",
        },
        {
          title: "Dress and pack practically",
          body: "Consider comfortable closed shoes, minimal valuables and a charged phone. Small bags speed up security checks and are easier to manage in crowds.",
        },
      ],
      during: [
        {
          title: "Stay on the edges of dense crowds",
          body: "Safety experts suggest avoiding the densest parts of a crowd where movement is restricted, and keeping note of the nearest exit as you move.",
        },
        {
          title: "Move diagonally in a crowd surge",
          body: "If a crowd begins to push, experts suggest staying on your feet, keeping arms up in front of your chest, and moving diagonally across the flow towards the edge rather than fighting straight against it.",
        },
        {
          title: "Leave early if unrest develops",
          body: "If a gathering turns confrontational, authorities suggest calmly leaving the area at the first signs rather than staying to watch. Follow directions from police and event staff.",
        },
        {
          title: "If separated from your group",
          body: "Consider heading to your agreed meeting point rather than searching in the crowd, and using messages rather than calls when networks are congested.",
        },
      ],
      after: [
        {
          title: "Get clear of the area",
          body: "After an incident, consider moving well away before stopping, as follow-on movements of the crowd can be unpredictable.",
        },
        {
          title: "Let people know you are safe",
          body: "Consider messaging family and friends promptly after a widely reported incident, since networks may become congested later.",
        },
        {
          title: "Seek support if affected",
          body: "Being caught in a crowd crush or unrest can be distressing. Consider talking to your GP or a support line if you notice ongoing effects.",
        },
      ],
    },
  },

  // --- Earthquake & Tsunami ---------------------------------------------------
  {
    slug: "earthquake",
    topicSlug: "earthquake-tsunami",
    title: "Earthquakes",
    summary:
      "What Geoscience Australia and emergency services suggest before, during and after an earthquake.",
    sortOrder: 0,
    sourceName: "Geoscience Australia",
    sourceUrl: "https://www.ga.gov.au",
    categoryKeywords: ["earthquake"],
    sections: {
      before: [
        {
          title: "Know that quakes happen here",
          body: "Australia records hundreds of earthquakes each year, and damaging quakes do occur. Consider learning the basics even if your area seems quiet.",
        },
        {
          title: "Secure heavy items",
          body: "Authorities suggest securing tall furniture, hot water systems and heavy wall items, which cause many earthquake injuries when they topple.",
        },
        {
          title: "Learn Drop, Cover, Hold",
          body: "Emergency services teach \"Drop, Cover and Hold on\": drop to the ground, take cover under sturdy furniture, and hold on until shaking stops. Consider practising it with your household.",
        },
      ],
      during: [
        {
          title: "Drop, cover and hold on",
          body: "If indoors, authorities suggest dropping, taking cover under a sturdy table away from windows, and holding on until the shaking stops. Running outside during shaking increases injury risk.",
        },
        {
          title: "If outdoors",
          body: "Consider moving to open ground away from buildings, trees and powerlines, then dropping to the ground until the shaking stops.",
        },
        {
          title: "If driving",
          body: "Authorities suggest pulling over away from bridges, overpasses and powerlines, and staying in the vehicle until shaking ends.",
        },
      ],
      after: [
        {
          title: "Expect aftershocks",
          body: "Aftershocks can follow for days and further damage weakened buildings. Authorities suggest being ready to drop, cover and hold on again.",
        },
        {
          title: "Check for hazards",
          body: "Consider checking for gas smells, electrical damage and structural cracks before staying in a building, and evacuating if it appears unsafe.",
        },
        {
          title: "Report and verify",
          body: "You can report felt earthquakes to Geoscience Australia, which helps scientists assess events. Rely on official sources rather than rumour for magnitude and damage information.",
        },
      ],
    },
  },
  {
    slug: "tsunami-warning",
    topicSlug: "earthquake-tsunami",
    title: "Tsunami warnings",
    summary:
      "Understanding Australian tsunami warnings and what authorities suggest doing when one is issued.",
    sortOrder: 1,
    sourceName: "Joint Australian Tsunami Warning Centre (Bureau of Meteorology)",
    sourceUrl: "http://www.bom.gov.au",
    categoryKeywords: ["earthquake", "tsunami"],
    sections: {
      before: [
        {
          title: "Know the warning system",
          body: "The Joint Australian Tsunami Warning Centre issues two main levels: Marine Warning (dangerous waves and currents) and Land Warning (inundation of low-lying coastal areas). Consider learning the difference.",
        },
        {
          title: "Know your ground height",
          body: "If you live or holiday near the coast, consider finding out how high above sea level you are and identifying routes to higher ground.",
        },
        {
          title: "Recognise natural signs",
          body: "A strong coastal earthquake, unusual sea withdrawal or a loud ocean roar can precede a tsunami. Authorities suggest treating these as warnings even before official messages arrive.",
        },
      ],
      during: [
        {
          title: "For a marine warning",
          body: "Authorities suggest getting out of the water, moving off beaches and away from harbours and coastal rocks, and securing boats if time safely allows.",
        },
        {
          title: "For a land warning",
          body: "Authorities recommend moving to high ground, ideally at least ten metres above sea level or more than one kilometre inland, on foot where possible to avoid traffic congestion.",
        },
        {
          title: "Stay away until cleared",
          body: "Tsunamis arrive as a series of waves over hours, and the first is often not the largest. Authorities advise staying away from the coast until the warning is formally cancelled.",
        },
      ],
      after: [
        {
          title: "Wait for the official cancellation",
          body: "Consider returning to low-lying areas only after the warning is cancelled and local authorities confirm it is safe.",
        },
        {
          title: "Avoid affected waters",
          body: "Dangerous currents can persist after waves pass. Authorities suggest staying out of the water and away from waterways for at least a day after an event.",
        },
        {
          title: "Watch for debris",
          body: "Consider treating beaches and foreshores with care after a tsunami, as debris and damaged structures can create hazards.",
        },
      ],
    },
  },

  // --- Power & Utilities --------------------------------------------------------
  {
    slug: "power-outage",
    topicSlug: "power-utilities",
    title: "Power outages",
    summary:
      "Getting through blackouts safely, based on energy provider guidance.",
    sortOrder: 0,
    sourceName: "Energy provider guidance (Energy Networks Australia)",
    sourceUrl: "https://www.energynetworks.com.au",
    categoryKeywords: ["utilities", "infrastructure"],
    sections: {
      before: [
        {
          title: "Prepare a blackout kit",
          body: "Consider keeping torches, spare batteries, charged power banks and a battery or wind-up radio somewhere easy to find in the dark.",
        },
        {
          title: "Plan for medical equipment",
          body: "If anyone in your home depends on powered medical equipment, providers suggest registering as a life-support customer with your retailer and having a backup plan for outages.",
        },
        {
          title: "Know your distributor",
          body: "Outages are managed by your local network distributor, not your retailer. Consider saving your distributor's outage line and website now.",
        },
      ],
      during: [
        {
          title: "Check the extent of the outage",
          body: "Consider checking whether neighbours have power and looking at your distributor's outage map, which usually shows cause and estimated restoration time.",
        },
        {
          title: "Protect appliances",
          body: "Providers suggest switching off appliances that were running, leaving one light on so you know when supply returns, to avoid damage from power surges.",
        },
        {
          title: "Keep fridges closed",
          body: "An unopened fridge keeps food safe for about four hours, and a full freezer for about 48 hours. Consider keeping doors closed as much as possible.",
        },
        {
          title: "Use generators and candles safely",
          body: "Authorities advise never running generators or barbecues indoors due to carbon monoxide risk, and keeping candles away from anything flammable and never unattended.",
        },
      ],
      after: [
        {
          title: "Check food safety",
          body: "Health authorities suggest discarding perishable food that has been above 5°C for more than four hours. When in doubt, throw it out.",
        },
        {
          title: "Restart appliances gradually",
          body: "Consider turning appliances back on progressively rather than all at once, and resetting clocks, alarms and timers.",
        },
        {
          title: "Report ongoing issues",
          body: "If your power has not returned when neighbours' has, consider checking your safety switch and then contacting your distributor.",
        },
      ],
    },
  },
  {
    slug: "gas-leak",
    topicSlug: "power-utilities",
    title: "Gas leaks",
    summary:
      "Recognising and responding to gas leaks at home, based on gas network guidance.",
    sortOrder: 1,
    sourceName: "Energy provider guidance (Australian Gas Networks)",
    sourceUrl: "https://www.australiangasnetworks.com.au",
    categoryKeywords: ["utilities", "infrastructure"],
    sections: {
      before: [
        {
          title: "Know the smell",
          body: "Natural gas has a distinctive rotten-egg odour added so leaks can be detected. Consider making sure everyone in your household knows the smell.",
        },
        {
          title: "Know your meter and shut-off valve",
          body: "Gas networks suggest knowing where your gas meter is and how to turn the supply off at the valve, so you can act quickly if needed.",
        },
        {
          title: "Maintain appliances",
          body: "Providers recommend having gas appliances serviced by a licensed gasfitter every two years, which also reduces carbon monoxide risk.",
        },
      ],
      during: [
        {
          title: "Avoid ignition sources",
          body: "If you smell gas, providers advise not operating light switches, phones or anything electrical near the smell, and extinguishing any flames.",
        },
        {
          title: "Ventilate and shut off",
          body: "Consider opening doors and windows and turning the gas off at the meter if you can do so safely.",
        },
        {
          title: "Leave and call from a distance",
          body: "Authorities suggest moving everyone away from the smell and calling your gas distributor's leak line from a safe distance. If the situation is dangerous, call 000.",
        },
      ],
      after: [
        {
          title: "Wait for clearance",
          body: "Consider staying out of the affected area until the leak has been located and repaired by the gas network or a licensed gasfitter.",
        },
        {
          title: "Have appliances checked",
          body: "If a leak was traced to an appliance or internal pipework, a licensed gasfitter should repair and test it before the gas is turned back on.",
        },
        {
          title: "Relight pilot lights safely",
          body: "After supply is restored, consider following manufacturer instructions to relight pilot lights, or asking a gasfitter to do it if you are unsure.",
        },
      ],
    },
  },
  {
    slug: "water-contamination",
    topicSlug: "power-utilities",
    title: "Water contamination",
    summary:
      "What to consider when a boil-water alert or contamination notice is issued for your supply.",
    sortOrder: 2,
    sourceName: "Australian Red Cross",
    sourceUrl: "https://www.redcross.org.au",
    categoryKeywords: ["utilities", "infrastructure"],
    sections: {
      before: [
        {
          title: "Store emergency water",
          body: "Emergency agencies suggest storing about ten litres of drinking water per person, enough for around three days, as part of your household emergency kit.",
        },
        {
          title: "Know your water utility",
          body: "Consider knowing which utility supplies your water and following their alerts, as boil-water notices are issued through them and health departments.",
        },
        {
          title: "Understand boil-water advice",
          body: "A boil-water alert means bringing water to a rolling boil and letting it cool before drinking. Consider learning what it covers: drinking, brushing teeth, washing food and making ice.",
        },
      ],
      during: [
        {
          title: "Boil or use bottled water",
          body: "During an alert, health authorities recommend using boiled (then cooled) or bottled water for drinking, food preparation, ice and pets.",
        },
        {
          title: "Take care with washing",
          body: "Authorities generally advise that showering is acceptable if you avoid swallowing water, while babies and small children may be better sponge-bathed.",
        },
        {
          title: "Discard suspect items",
          body: "Consider discarding ice, drinks and uncooked foods made with tap water after the contamination began.",
        },
      ],
      after: [
        {
          title: "Flush your plumbing",
          body: "Once an alert is lifted, utilities typically suggest running cold taps for a few minutes and flushing appliances that use water, such as ice makers.",
        },
        {
          title: "Replace filters",
          body: "Consider replacing water filter cartridges that were used during the contamination period, as they may harbour microorganisms.",
        },
        {
          title: "Watch for symptoms",
          body: "If anyone develops gastro symptoms after a contamination event, consider seeing a GP and mentioning the water alert.",
        },
      ],
    },
  },

  // --- Travel Safety ------------------------------------------------------------
  {
    slug: "travel-advisories",
    topicSlug: "travel-safety",
    title: "Travel advisories",
    summary:
      "Using Smartraveller advice levels to plan safer trips overseas.",
    sortOrder: 0,
    sourceName: "Smartraveller (DFAT)",
    sourceUrl: "https://www.smartraveller.gov.au",
    categoryKeywords: ["travel", "community"],
    sections: {
      before: [
        {
          title: "Check the advice level",
          body: "Smartraveller rates destinations across four levels, from \"exercise normal safety precautions\" to \"do not travel\". Consider checking your destination before booking and again before departing.",
        },
        {
          title: "Subscribe to updates",
          body: "Smartraveller suggests subscribing to updates for your destinations, so you hear about changes to safety, security and entry requirements.",
        },
        {
          title: "Arrange insurance",
          body: "DFAT's consistent message is that if you can't afford travel insurance, you can't afford to travel. Consider checking your policy covers your destination and activities.",
        },
        {
          title: "Share your itinerary",
          body: "Consider leaving a copy of your itinerary and passport details with someone at home, and carrying emergency contacts separately from your phone.",
        },
      ],
      during: [
        {
          title: "Stay across local conditions",
          body: "Conditions can change quickly abroad. Consider re-checking Smartraveller and local news during your trip, particularly around elections, unrest or severe weather.",
        },
        {
          title: "Respect local laws",
          body: "Smartraveller notes that you are subject to local laws overseas, and penalties can be severe for things legal in Australia. Consider researching local laws and customs before you go.",
        },
        {
          title: "Know where help is",
          body: "Consider noting the nearest Australian embassy or consulate, and the Consular Emergency Centre (+61 2 6261 3305), available 24/7 for Australians overseas.",
        },
      ],
      after: [
        {
          title: "Review your documents",
          body: "After travel, consider checking your passport validity for future trips; many countries require six months beyond your travel dates.",
        },
        {
          title: "Watch your health",
          body: "If you become unwell after travelling, consider seeing a GP and mentioning where you have been, as some travel illnesses appear weeks later.",
        },
        {
          title: "Report issues",
          body: "If you experienced serious problems abroad, consider reporting them to Smartraveller or the relevant authorities to help other travellers.",
        },
      ],
    },
  },
  {
    slug: "natural-disasters-overseas",
    topicSlug: "travel-safety",
    title: "Natural disasters overseas",
    summary:
      "What Smartraveller suggests if a disaster strikes while you are travelling.",
    sortOrder: 1,
    sourceName: "Smartraveller (DFAT)",
    sourceUrl: "https://www.smartraveller.gov.au",
    categoryKeywords: ["travel", "community"],
    sections: {
      before: [
        {
          title: "Research seasonal risks",
          body: "Many destinations have cyclone, monsoon or wildfire seasons. Smartraveller suggests researching seasonal hazards for your destination and timing.",
        },
        {
          title: "Check your insurance for disasters",
          body: "Consider confirming whether your policy covers natural disasters and what it requires, as cover can change once an event is officially forecast.",
        },
        {
          title: "Learn local warning systems",
          body: "Consider finding out how local authorities issue warnings at your destination, such as sirens, SMS alerts or apps, and how you would receive them.",
        },
      ],
      during: [
        {
          title: "Follow local authorities",
          body: "In a disaster overseas, Smartraveller advises following the instructions of local authorities and your accommodation, as they know local conditions best.",
        },
        {
          title: "Let people know you are safe",
          body: "Consider contacting family early, as networks may fail later. If you cannot reach them, the DFAT Consular Emergency Centre can be a point of contact.",
        },
        {
          title: "Keep documents with you",
          body: "Consider keeping your passport, insurance details and some cash in a waterproof bag if you may need to move quickly.",
        },
        {
          title: "Contact consular services if needed",
          body: "Australians in difficulty overseas can contact the Consular Emergency Centre on +61 2 6261 3305 at any time.",
        },
      ],
      after: [
        {
          title: "Follow recovery instructions",
          body: "Consider following local guidance about returning to affected areas, water safety and disease risks after a disaster.",
        },
        {
          title: "Contact your airline and insurer",
          body: "Consider contacting your airline about disrupted flights and notifying your insurer as early as possible, keeping receipts for extra expenses.",
        },
        {
          title: "Check in with Smartraveller",
          body: "Advice levels often change after disasters. Consider re-checking Smartraveller before continuing your trip or booking new travel in the region.",
        },
      ],
    },
  },
  {
    slug: "emergency-kit-essentials",
    topicSlug: "travel-safety",
    title: "Emergency kit essentials",
    summary:
      "Building a household emergency kit using the Red Cross RediPlan approach.",
    sortOrder: 2,
    sourceName: "Australian Red Cross (RediPlan)",
    sourceUrl: "https://www.redcross.org.au",
    categoryKeywords: ["travel", "community"],
    sections: {
      before: [
        {
          title: "Start with the basics",
          body: "The Red Cross suggests a kit with water, non-perishable food, a torch, a battery radio, spare batteries and a first-aid kit as the foundation.",
        },
        {
          title: "Add documents and cash",
          body: "Consider keeping copies of important documents — identification, insurance, prescriptions — in a waterproof bag, along with some cash in small notes.",
        },
        {
          title: "Personalise your kit",
          body: "Authorities suggest tailoring the kit to your household: medications, glasses, baby supplies, pet food and comfort items for children.",
        },
        {
          title: "Make it portable",
          body: "Consider storing the kit in a sturdy bag you could carry if evacuating, kept somewhere everyone in the household knows.",
        },
      ],
      during: [
        {
          title: "Grab the kit early",
          body: "If an emergency threatens, consider putting your kit by the door or in the car early, before you are under pressure to leave.",
        },
        {
          title: "Add last-minute items",
          body: "Consider keeping a short list on the kit of last-minute additions like phones, chargers, wallets and medications kept in the fridge.",
        },
        {
          title: "Use supplies sensibly",
          body: "During a prolonged emergency, consider rationing water and food, and using the radio to follow official updates while conserving phone battery.",
        },
      ],
      after: [
        {
          title: "Restock promptly",
          body: "Consider replacing anything used as soon as normal supplies are available, so the kit is ready for the next event.",
        },
        {
          title: "Check the kit twice a year",
          body: "The Red Cross suggests checking your kit every six months for expired food, medication and flat batteries — daylight-saving changes are an easy reminder.",
        },
        {
          title: "Review your plan",
          body: "After using the kit for real, consider what was missing or unnecessary, and update both the kit and your household emergency plan.",
        },
      ],
    },
  },
];

/**
 * Finds hazard category ids whose names contain any of the given keywords
 * (case-insensitive).
 */
const matchCategoryIds = (
  categories: { id: string; name: string }[],
  keywords: string[],
): string[] => {
  const lowered = keywords.map((k) => k.toLowerCase());
  return categories
    .filter((category) => {
      const name = category.name.toLowerCase();
      return lowered.some((keyword) => name.includes(keyword));
    })
    .map((category) => category.id);
};

/**
 * Seeds Learn hub safety guide topics and guides. Idempotent — topics and
 * guides are upserted by slug, so re-running refreshes content in place.
 */
export const seedSafetyGuides = async (): Promise<void> => {
  // Upsert topics and remember their ids by slug
  const topicIdBySlug = new Map<string, string>();

  for (const topic of topics) {
    const record = await prisma.safetyGuideTopic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        color: topic.color,
        sortOrder: topic.sortOrder,
      },
      create: {
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        color: topic.color,
        sortOrder: topic.sortOrder,
      },
    });
    topicIdBySlug.set(topic.slug, record.id);
  }

  // Load hazard categories once for the keyword -> categoryIds mapping
  const hazardCategories = await prisma.hazardCategory.findMany({
    select: { id: true, name: true },
  });

  for (const guide of guides) {
    const topicId = topicIdBySlug.get(guide.topicSlug);
    if (!topicId) {
      console.error(
        `Safety guide seed: missing topic '${guide.topicSlug}' for guide '${guide.slug}'`,
      );
      continue;
    }

    const categoryIds = matchCategoryIds(
      hazardCategories,
      guide.categoryKeywords,
    );
    const sourceNote = sourceNoteFor(guide.sourceName, guide.sourceUrl);
    const sections = guide.sections as Prisma.InputJsonValue;

    const data = {
      topicId,
      title: guide.title,
      summary: guide.summary,
      sections,
      sourceName: guide.sourceName,
      sourceUrl: guide.sourceUrl,
      sourceNote,
      xpReward: 10,
      categoryIds,
      sortOrder: guide.sortOrder,
      isPublished: true,
    };

    await prisma.safetyGuide.upsert({
      where: { slug: guide.slug },
      update: data,
      create: { slug: guide.slug, ...data },
    });
  }

  console.log(
    `---------------------------------------> Safety guides seeded (${topics.length} topics, ${guides.length} guides)`,
  );
};
