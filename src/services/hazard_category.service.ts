import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardCategory,
  HazardReviewStatus,
  HazardSeverity,
  LocationSubscription,
  Prisma,
} from "@prisma/client";
import type { HazardSeverityWithAwsCompliant } from "../models/hazard_search_params_interface.js";

/**
 * Populate the database with a predefined set of hazard categories.
 * If a category already exists, it will not be duplicated.
 */
export const populateInitialCategories = async () => {
  try {
    const categories: Prisma.HazardCategoryCreateInput[] = [
      {
        id: "safetyAndSecurity",
        name: "Safety & Security",
        description: "Crime, Civil Unrest, Terror Threat",
        color: "#FC9493",
        severityKeywords: {
          unknown: [],
          info: ["suspicious activity", "increased security", "security alert"],
          advice: ["ongoing investigation", "avoid area", "caution advised"],
          watchAndAct: [
            "active threat",
            "shelter in place",
            "immediate danger",
          ],
          emergency: [
            "armed incident",
            "immediate evacuation",
            "life threatening",
          ],
        },
        callToActions: {
          info: [
            "Stay alert to surroundings.",
            "Report suspicious activity to police.",
            "Follow official updates.",
          ],
          advice: [
            "Avoid the affected area.",
            "Keep doors locked.",
            "Stay indoors if possible.",
          ],
          watchAndAct: [
            "Shelter in place immediately.",
            "Stay away from windows.",
            "Follow police instructions.",
          ],
          emergency: [
            "Evacuate immediately if safe to do so.",
            "Call 000 if in immediate danger.",
            "Follow emergency services directions only.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "rescueRoad" },
              create: {
                id: "rescueRoad",
                name: "Rescue (Road)",
                description:
                  "Rescue operations for trapped individuals on roads",
                severityKeywords: {
                  info: [
                    "vehicle assistance",
                    "minor breakdown",
                    "flat tyre",
                    "stalled vehicle",
                    "traffic control in place",
                  ],
                  advice: [
                    "single-vehicle incident",
                    "no injuries reported",
                    "minor entrapment",
                    "tow required",
                    "lane blocked",
                  ],
                  watchAndAct: [
                    "multi-vehicle crash",
                    "confirmed entrapment",
                    "moderate injuries",
                    "roof removal",
                    "heavy rescue responding",
                    "serious crash",
                  ],
                  emergency: [
                    "mass-casualty crash",
                    "multiple entrapments",
                    "vehicle fire + rescue",
                    "life-threatening injuries",
                    "complex extrication",
                    "evacuation or closure in effect",
                  ],
                },
                callToActions: {
                  info: [
                    "Slow down near scene.",
                    "Don't film or distract emergency crews.",
                    "Follow traffic control directions.",
                    "Keep emergency lane clear.",
                  ],
                  advice: [
                    "Detour if possible.",
                    "Keep a safe distance.",
                    "Turn on hazard lights in low visibility.",
                    "Remain patient; avoid rubbernecking.",
                  ],
                  watchAndAct: [
                    "Avoid area entirely.",
                    "Allow space for rescue vehicles.",
                    "Expect extended delays.",
                    "Report fuel leaks or hazards if first on scene.",
                  ],
                  emergency: [
                    "Follow police and emergency directions only.",
                    "Avoid live powerlines or fuel spills.",
                    "Do not attempt rescue unless trained.",
                    "Use alternate routes and keep updated.",
                  ],
                },
              },
            },
            {
              where: { id: "rescueMarine" },
              create: {
                id: "rescueMarine",
                name: "Rescue (Marine)",
                description:
                  "Rescue operations for trapped individuals in water",
                severityKeywords: {
                  info: [
                    "vessel adrift (no distress)",
                    "mechanical issue",
                    "shoreline assistance",
                    "water rescue in progress",
                  ],
                  advice: [
                    "tow requested",
                    "non-urgent assist",
                    "minor entrapment",
                    "minor injury onboard",
                    "nearshore rescue",
                  ],
                  watchAndAct: [
                    "person overboard",
                    "vessel taking on water",
                    "medevac required",
                    "hazardous seas",
                  ],
                  emergency: [
                    "sinking vessel",
                    "mayday",
                    "multiple persons in water",
                    "mass rescue",
                    "life-threatening injuries",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid congesting rescue area.",
                    "Maintain radio silence on marine emergency channels.",
                    "Keep clear of rescue craft.",
                  ],
                  advice: [
                    "Stay clear of affected zone.",
                    "Report sightings to local maritime authority.",
                    "Maintain safe boating distances.",
                  ],
                  watchAndAct: [
                    "Avoid launching or entering same area.",
                    "Give space to helicopters and boats.",
                    "Monitor official marine updates.",
                    "Assist only if directed.",
                  ],
                  emergency: [
                    "Keep all non-rescue craft clear.",
                    "Do not approach shore rescue zones.",
                    "Follow beach closure signs.",
                    "Report debris or survivors to authorities immediately.",
                  ],
                },
              },
            },
            {
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
                severityKeywords: {
                  info: [
                    "police operation notice",
                    "increased patrols",
                    "information request",
                    "CCTV review",
                  ],
                  advice: [
                    "minor assault/theft",
                    "arrest made",
                    "no ongoing threat",
                    "local disruption",
                  ],
                  watchAndAct: [
                    "armed robbery",
                    "wanted person in area",
                    "search underway",
                    "cordons/road closures",
                  ],
                  emergency: [
                    "active threat/armed offender",
                    "shots fired",
                    "hostage/siege",
                    "immediate danger",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid location.",
                    "Follow traffic diversions.",
                    "Don't share rumours online.",
                  ],
                  advice: [
                    "Lock doors and move indoors as advised.",
                    "Keep phone on silent.",
                    "If near windows move away from windows.",
                  ],
                  watchAndAct: [
                    "Stay quiet and keep low.",
                    "Silence electronics.",
                    "Don't open doors unless police identify themselves.",
                    "Wait for the all-clear from police.",
                  ],
                  emergency: [
                    "Escape the area if safe to do so.",
                    "If unable to escape, hide and barricade.",
                    "Keep phone on silent and stay calm.",
                    "Call 000 when safe.",
                  ],
                },
              },
            },
            {
              where: { id: "terror" },
              create: {
                id: "terror",
                name: "Terror",
                description: "Terror threats and incidents",
                severityKeywords: {
                  info: [
                    "police awareness",
                    "threat under investigation",
                    "no active danger",
                    "police presence",
                    "routine patrol investigation ongoing",
                  ],
                  advice: [
                    "suspicious package/person",
                    "security operation",
                    "precautionary evacuation",
                  ],
                  watchAndAct: [
                    "confirmed armed person",
                    "sighted suspicious activity",
                    "lockdown in place",
                    "attack likely",
                    "major police response",
                  ],
                  emergency: [
                    "active shooter/armed offender",
                    "terrorism-related incident",
                    "immediate threat to life",
                    "shelter now/evacuate immediately",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid the location.",
                    "Don't spread rumours.",
                    "Follow verified sources only.",
                    "Keep calm if in vicinity.",
                  ],
                  advice: [
                    "Stay indoors and lock doors.",
                    "Keep phone on silent.",
                    "Move away from windows.",
                    "Await police direction.",
                  ],
                  watchAndAct: [
                    "Hide and barricade if escape not safe.",
                    "Silence devices.",
                    "Keep low and quiet.",
                    "Call 000 if safe to give information.",
                  ],
                  emergency: [
                    "Escape if possible, otherwise shelter in place.",
                    "Warn others quietly.",
                    "Do not approach suspect.",
                    "Follow police evacuation instructions only.",
                  ],
                },
              },
            },
            {
              where: { id: "missingPerson" },
              create: {
                id: "missingPerson",
                name: "Missing Person",
                description: "Reports of missing individuals",
                severityKeywords: {
                  info: ["last seen", "search ongoing", "family notified"],
                  advice: [
                    "report sightings",
                    "do not approach",
                    "contact authorities",
                    "vulnerable person missing (child or elderly)",
                  ],
                },
                callToActions: {
                  info: [
                    "Review photo/details carefully.",
                    "Share official post, not screenshots.",
                    "Do not speculate or comment online.",
                    "Report verified sightings to police.",
                  ],
                  advice: [
                    "Check sheds, garages, yards.",
                    "Search waterways or bush edges if safe.",
                    "Keep phone nearby for updates.",
                    "Avoid crowding police search areas.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "healthAndEmergency",
        name: "Health & Medical",
        description: "Health emergencies and medical incidents",
        color: "#FCC27B",
        severityKeywords: {
          unknown: ["not applicable"],
          info: ["health advisory", "monitoring", "precautionary"],
          advice: [
            "seek medical attention",
            "symptoms reported",
            "contamination possible",
          ],
          watchAndAct: ["outbreak", "multiple cases", "quarantine"],
          emergency: [
            "critical outbreak",
            "mass casualties",
            "immediate medical attention",
          ],
        },
        callToActions: {
          info: [
            "Follow health advisories.",
            "Maintain good hygiene.",
            "Monitor symptoms.",
          ],
          advice: [
            "Seek medical advice if symptoms develop.",
            "Avoid contact with affected individuals.",
            "Follow hygiene protocols.",
          ],
          watchAndAct: [
            "Isolate if symptoms present.",
            "Contact health authorities.",
            "Follow quarantine procedures.",
          ],
          emergency: [
            "Seek immediate medical attention.",
            "Call 000 for medical emergency.",
            "Follow evacuation orders if issued.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "ambulanceResponse" },
              create: {
                id: "ambulanceResponse",
                name: "Ambulance Response",
                description: "Emergency medical services dispatched",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "on scene",
                    "units on route",
                    "ambulance dispatched",
                    "routine call",
                    "assessment",
                    "urgent response",
                  ],
                  advice: [
                    "serious condition",
                    "multiple units",
                    "critical patient",
                    "air ambulance",
                    "trauma team",
                    "mass casualty",
                    "disaster response",
                    "overwhelming demand",
                  ],
                },
                callToActions: {
                  info: [
                    "Keep access roads clear.",
                    "Stay out of emergency areas.",
                    "Move vehicles if blocking path.",
                  ],
                  advice: [
                    "Allow emergency access.",
                    "Do not crowd scene.",
                    "Offer help only if trained.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "weatherAndEnvironment",
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        color: "#97D7FA",
        severityKeywords: {
          unknown: [],
          info: ["weather watch", "monitoring", "developing conditions"],
          advice: ["weather warning", "prepare", "potential impact"],
          watchAndAct: [
            "dangerous conditions",
            "take action",
            "immediate threat",
          ],
          emergency: ["catastrophic", "life threatening", "extreme danger"],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "bushfire" },
              create: {
                id: "bushfire",
                name: "Bushfire",
                description: "Wildfire and bushfire incidents",
                severityKeywords: {
                  unknown: ["not applicable", "burn off", "planned burn"],
                  info: ["info", "information"],
                  advice: ["advice", "level 1 but not burn off"],
                  watchAndAct: [
                    "watch and act",
                    "watchAndAct",
                    "level 2 but not burn off",
                  ],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                    "level 3 but not burn off",
                  ],
                },
                callToActions: {
                  unknown: ["No action required"],
                  info: ["Stay informed and monitor updates"],
                  advice: [
                    "Pack essentials (IDs, meds, charger, pets).",
                    "Identify two exit routes.",
                    "Move flammable items from around home.",
                    "Tune to ABC Radio or official app.",
                  ],
                  watchAndAct: [
                    "Relocate early if directed.",
                    "Wear long sleeves and cover skin.",
                    "Wet down areas near buildings.",
                    "Tell friends/family your location.",
                  ],
                  emergency: [
                    "Get below window height, use wool blanket.",
                    "Fill sinks/buckets with water.",
                    "Avoid roads with heavy smoke.",
                    "Contact 000 only if in immediate danger.",
                  ],
                },
              },
            },
            {
              where: { id: "cyclone" },
              create: {
                id: "cyclone",
                name: "Cyclone",
                description: "Severe weather hazards including cyclones",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Review emergency plan.",
                    "Check roof and gutters.",
                    "Restock supplies.",
                    "Secure outdoor furniture.",
                    "Board up windows.",
                    "Move vehicles to shelter.",
                    "Prepare emergency kit.",
                    "Know your nearest shelter location.",
                  ],
                  watchAndAct: [
                    "Evacuate low-lying areas.",
                    "Turn off gas and electricity.",
                    "Bring pets inside.",
                    "Shelter in strongest part of house.",
                  ],
                  emergency: [
                    "Remain indoors until authorities say it's safe.",
                    "Don't go outside during the 'eye'.",
                    "Keep radio on battery power.",
                    "Call emergency only for life-threatening situations.",
                  ],
                },
              },
            },
            {
              where: { id: "storm" },
              create: {
                id: "storm",
                name: "Storm",
                description: "Active storm events including thunderstorms",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Bring pets and washing indoors.",
                    "Check roof gutters.",
                    "Secure outdoor items.",
                    "Keep torch charged.",
                    "Park vehicles under cover.",
                    "Avoid tall trees and powerlines.",
                    "Charge phones and devices.",
                    "Follow local alerts.",
                  ],
                  watchAndAct: [
                    "Stay indoors and away from windows.",
                    "Turn off appliances at wall.",
                    "Avoid using landline phones.",
                    "Keep children and pets inside.",
                  ],
                  emergency: [
                    "Shelter in a small interior room.",
                    "Use mattress for protection from debris.",
                    "Do not drive until danger passes.",
                    "Report injuries or damage after all-clear.",
                  ],
                },
              },
            },
            {
              where: { id: "flood" },
              create: {
                id: "flood",
                name: "Flood",
                description: "Flooding and water-related emergencies",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Check BOM river heights.",
                    "Move valuables off floors.",
                    "Keep car fuelled and ready.",
                    "Don't play or wade in floodwater.",
                    "Sandbag doorways.",
                    "Move livestock and pets to high ground.",
                    "Unplug electricals.",
                    "Secure gas bottles.",
                  ],
                  watchAndAct: [
                    "Move to higher ground now.",
                    "Never drive through water — 15 cm can move a car.",
                    "Follow SES directions.",
                    "Keep emergency kit near door.",
                  ],
                  emergency: [
                    "Evacuate immediately.",
                    "Avoid bridges and drains.",
                    "Stay on solid, elevated ground.",
                    "Call 000 if trapped.",
                  ],
                },
              },
            },
            {
              where: { id: "extremeHeat" },
              create: {
                id: "extremeHeat",
                name: "Extreme Heat",
                description: "Extreme heat events and heatwaves",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Close blinds early to keep house cool.",
                    "Avoid outdoors 10 am–3 pm.",
                    "Check on elderly neighbours.",
                    "Keep pets shaded with cool water.",
                  ],
                  watchAndAct: [
                    "Move to air-conditioned or shaded areas.",
                    "Use cool showers or damp towels.",
                    "Schedule outdoor work early morning only.",
                    "Monitor for signs of heat exhaustion.",
                  ],
                  emergency: [
                    "Go to community cooling centre if unsafe at home.",
                    "Call emergency if confused or fainting.",
                    "Avoid physical activity entirely.",
                    "Keep power use low to prevent blackouts.",
                  ],
                },
              },
            },
            {
              where: { id: "damagingWinds" },
              create: {
                id: "damagingWinds",
                name: "Damaging Winds",
                description: "High wind events causing damage",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Bring in loose objects and garden furniture.",
                    "Park vehicles away from trees.",
                    "Close windows and blinds.",
                    "Avoid climbing or roof work.",
                    "Move indoors before gusts intensify.",
                    "Keep pets inside.",
                    "Stay clear of trees and powerlines.",
                    "Monitor for falling debris.",
                  ],
                  watchAndAct: [
                    "Stay away from windows and glass doors.",
                    "Move to lowest, central room.",
                    "Unplug electronics to prevent damage.",
                    "Don't use lifts during outages.",
                  ],
                  emergency: [
                    "Shelter immediately in strongest part of building.",
                    "Protect head and neck from debris.",
                    "Wait for official all-clear before going out.",
                    "Report major damage once safe.",
                  ],
                },
              },
            },
            {
              where: { id: "snow" },
              create: {
                id: "snow",
                name: "Snow",
                description: "Snowfall and winter weather conditions",
                severityKeywords: {
                  unknown: ["not applicable"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
                  ],
                },
                callToActions: {
                  advice: [
                    "Slow down and increase stopping distance on roads.",
                    "Use low-beam headlights in snow or fog.",
                    "Carry tyre chains if travelling above snow line.",
                    "Protect pets and livestock from cold exposure.",
                    "Watch for black ice on bridges and shaded areas.",
                  ],
                  watchAndAct: [
                    "Postpone non-essential travel; if driving, tell someone your route.",
                    "Keep a charged phone, torch, and emergency kit in the car.",
                    "Bring outdoor pets and supplies inside.",
                    "Clear snow from vents, paths, and roofs to prevent buildup.",
                    "Check elderly neighbours or isolated residents.",
                  ],
                  emergency: [
                    "Stay indoors or shelter immediately; travel only if emergency.",
                    "If trapped in a vehicle, stay inside, run engine 10 min/hr for warmth, and clear exhaust pipe.",
                    "Use extra blankets, clothing, and body heat to stay warm.",
                    "Avoid carbon-monoxide exposure from indoor heaters or generators.",
                    "Follow emergency updates for power restoration and evacuation centres.",
                  ],
                },
              },
            },
            {
              where: { id: "tsunami" },
              create: {
                id: "tsunami",
                name: "Tsunami",
                description: "Tsunami events and warnings",
                severityKeywords: {
                  unknown: [
                    "warning cancelled",
                    "return with caution",
                    "hazards may persist (currents)",
                  ],
                  advice: [
                    "tsunami possible",
                    "stand by for update",
                    "assess risk",
                    "monitor official advice",
                  ],
                  emergency: [
                    "inundation of land likely",
                    "evacuate to higher ground",
                    "move inland immediately",
                  ],
                },
                callToActions: {
                  unknown: [
                    "Stay off beaches and marinas until authorities declare safe.",
                    "Avoid swimming or boating for several hours.",
                    "Follow local updates for re-entry guidance.",
                  ],
                  advice: [
                    "Move away from beaches and harbours.",
                    "Check emergency alerts hourly.",
                    "Keep radio or phone charged.",
                    "Know your evacuation route to higher ground.",
                  ],
                  emergency: [
                    "Leave coastal areas immediately, go 1 km inland or 10 m above sea level.",
                    "Don't wait to see the wave.",
                    "Move on foot if possible — avoid congestion.",
                    "Stay clear of rivers and estuaries.",
                  ],
                },
              },
            },
            {
              where: { id: "volcanicActivity" },
              create: {
                id: "volcanicActivity",
                name: "Volcanic Activity",
                description: "Volcanic eruptions and ash fall",
                severityKeywords: {
                  advice: [
                    "increased seismicity",
                    "elevated gas/ash",
                    "minor ash emissions",
                    "alert raised",
                    "limit outdoor exposure",
                  ],
                  watchAndAct: [
                    "eruption likely/underway (low-level)",
                    "ash plume affecting air ",
                    "dangerous ash fall",
                    "evacuate if advised",
                  ],
                  emergency: [
                    "significant eruption underway",
                    "pyroclastic flows/lahars",
                    "evacuate immediately",
                    "life-threatening ashfall/gases",
                  ],
                },
                callToActions: {
                  advice: [
                    "Wear mask and goggles if ash present.",
                    "Keep windows and doors closed.",
                    "Protect electronics from dust.",
                    "Prepare to evacuate if advised.",
                    "Stay informed through official updates.",
                    "Prepare go-bag.",
                    "Avoid river valleys downstream.",
                    "Close windows and doors.",
                    "Wear mask and goggles outdoors.",
                    "Protect electronics from dust.",
                  ],
                  watchAndAct: [
                    "Evacuate exclusion zones.",
                    "Drive with lights on.",
                    "Avoid low areas prone to lahars.",
                    "Keep water and food sealed.",
                    "Stay indoors unless evacuating.",
                    "Cover nose and mouth with damp cloth.",
                    "Avoid driving; visibility poor.",
                    "Move animals to sheltered areas.",
                  ],
                  emergency: [
                    "Evacuate now via safe route.",
                    "Cover mouth/nose with cloth.",
                    "Avoid bridges, valleys, rivers.",
                    "Stay tuned for evacuation centre updates.",
                    "Follow evacuation orders immediately.",
                    "Avoid river valleys (lahar paths).",
                    "Use sturdy footwear and masks.",
                    "Tune to emergency broadcasts for safe zones.",
                  ],
                },
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                severityKeywords: {
                  info: [
                    "minor tremor",
                    "magnitude <3.5",
                    "no damage expected",
                  ],
                  advice: [
                    "felt shaking",
                    "magnitude 3.5–4.9",
                    "minor damage reports",
                    "inspect structures",
                    "moderate earthquake",
                    "minor damage possible",
                  ],
                  watchAndAct: [
                    "magnitude 5.0–6.4",
                    "structural damage",
                    "injuries possible",
                    "aftershocks likely",
                    "drop, cover, and hold on",
                  ],
                  emergency: [
                    "magnitude ≥6.5",
                    "major damage",
                    "building collapse",
                    "widespread injuries",
                    "liquefaction/landslide",
                    "serious damage and aftershocks",
                  ],
                },
                callToActions: {
                  info: [
                    "Check for fallen items.",
                    "Review emergency kit.",
                    "Expect small aftershocks.",
                    "Inspect your home for cracks or leaks.",
                    "Avoid tall structures until cleared.",
                    "Keep mobile phone and torch handy.",
                  ],
                  advice: [
                    "Stay alert for damage.",
                    "Avoid tall buildings until inspected.",
                    "Keep flashlight handy.",
                    "Secure heavy furniture.",
                    "Inspect your home for cracks or leaks.",
                    "Avoid tall structures until cleared.",
                    "Keep mobile phone and torch handy.",
                  ],
                  watchAndAct: [
                    "Drop, cover, hold on.",
                    "Stay indoors until shaking stops.",
                    "Move away from windows.",
                    "Turn off gas if safe.",
                    "Get under sturdy furniture.",
                    "Stay indoors until shaking stops.",
                    "Move away from glass and heavy items.",
                    "Don't use lifts.",
                  ],
                  emergency: [
                    "Avoid damaged structures.",
                    "Expect aftershocks.",
                    "Help others only if safe.",
                    "Listen for official updates.",
                    "Stay away from damaged buildings and powerlines.",
                    "Help others only if safe.",
                    "Expect service interruptions.",
                    "Follow official evacuation and shelter advice.",
                  ],
                },
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
                severityKeywords: {
                  advice: [
                    "Landslip risk",
                    "cracks in ground",
                    "small rockfalls",
                    "avoid steep embankments",
                    "monitor slopes",
                    "road cut by debris",
                    "significant movement detected",
                  ],
                  emergency: [
                    "landslide occurring / imminent",
                    "evacuate immediately",
                    "life-threatening slope failure",
                    "multiple structures impacted",
                    "multiple casualties",
                  ],
                },
                callToActions: {
                  advice: [
                    "Avoid cliff edges.",
                    "Watch for cracks in ground.",
                    "Stay on stable terrain.",
                    "Move to safe zone.",
                    "Report signs to authorities.",
                    "Relocate valuables.",
                  ],
                  emergency: [
                    "Evacuate immediately if told.",
                    "Avoid creeks and slopes.",
                    "Keep away from retaining walls.",
                    "Move uphill fast.",
                    "Warn others as you go.",
                    "Stay clear of debris and runoff paths.",
                  ],
                },
              },
            },
            {
              where: { id: "smoke" },
              create: {
                id: "smoke",
                name: "Smoke",
                description: "Smoke from fires affecting air quality",
                severityKeywords: {
                  unknown: [],
                  info: ["light smoke", "hazy", "distant fire"],
                  advice: ["thick smoke", "poor visibility", "stay indoors"],
                  watchAndAct: ["heavy smoke", "dangerous air", "health risk"],
                  emergency: [
                    "extreme smoke",
                    "zero visibility",
                    "immediate health threat",
                  ],
                },
                callToActions: {
                  info: [
                    "Close windows and doors.",
                    "Avoid outdoor exercise.",
                    "Monitor air quality updates.",
                  ],
                  advice: [
                    "Stay indoors with air conditioning on recirculate.",
                    "Wear P2/N95 mask if must go outside.",
                    "Keep medications handy for breathing conditions.",
                  ],
                  watchAndAct: [
                    "Do not go outside.",
                    "Seal gaps in doors and windows.",
                    "Use air purifiers if available.",
                  ],
                  emergency: [
                    "Evacuate if directed.",
                    "Seek medical attention for breathing difficulties.",
                    "Use wet cloth over mouth if evacuation necessary.",
                  ],
                },
              },
            },
            {
              where: { id: "pollen" },
              create: {
                id: "pollen",
                name: "Pollen",
                description: "Pollen from plants affecting air quality",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "low pollen count",
                    "minimal symptoms expected",
                    "Low 0–19",
                    "low pollen count, minimal symptoms, routine advisory",
                  ],
                  advice: [
                    "moderate pollen",
                    "hayfever likely for sensitive people",
                    "Moderate 20–49",
                    "moderate pollen, hayfever likely for sensitive people",
                  ],
                  watchAndAct: [
                    "high pollen",
                    "widespread symptoms",
                    "asthma flare risk",
                    "High 50–99",
                    "high pollen, widespread symptoms, thunderstorm asthma risk rising",
                  ],
                  emergency: [
                    "extreme pollen/thunderstorm asthma risk",
                    "health alert",
                    "stay indoors/medication plan",
                    "extreme ≥100",
                    "extreme pollen, health alert, stay indoors/medication plan, avoid outdoor activity",
                  ],
                },
                callToActions: {
                  info: [
                    "Keep windows closed at night.",
                    "Track daily pollen forecast.",
                    "Carry tissues/eye drops.",
                  ],
                  advice: [
                    "Take antihistamines early.",
                    "Avoid outdoor gardening.",
                    "Dry clothes indoors.",
                  ],
                  watchAndAct: [
                    "Use preventer/reliever inhaler.",
                    "Stay indoors before and after storms.",
                    "Keep car windows shut.",
                  ],
                  emergency: [
                    "Stay indoors during storm activity.",
                    "Follow asthma action plan.",
                    "Seek urgent medical care if breathless.",
                  ],
                },
              },
            },
            {
              where: { id: "poorAirQuality" },
              create: {
                id: "poorAirQuality",
                name: "Poor Air Quality",
                description: "Air pollution and quality concerns",
                severityKeywords: {
                  advice: [
                    "Poor >25–50 µg/m³",
                    "smoke drift",
                    "minor smoke",
                    "smoke from prescribed/planned/hazard-reduction burn",
                    "advisory issued",
                    "no specific health action beyond awareness",
                  ],
                  watchAndAct: [
                    "Very poor >50–150 µg/m³",
                    "health advisory issued",
                    "poor air quality",
                    "visibility reduced",
                    "stay indoors advised (esp. sensitive groups)",
                    "AQI well above guideline",
                  ],
                  emergency: [
                    "Extremely poor >150 µg/m³",
                    "very poor/hazardous AQI",
                    "thick smoke hazard",
                    "remain indoors",
                    "vulnerable groups at risk",
                    "shelter in place/toxic plume during major fires/industrial events",
                  ],
                },
                callToActions: {
                  advice: [
                    "Wear P2/N95 mask outdoors.",
                    "Keep asthma medication close.",
                    "Check AQI in app hourly.",
                  ],
                  watchAndAct: [
                    "Stay indoors with filtered air.",
                    "Use damp cloths on gaps.",
                    "Avoid vacuuming (stirs dust).",
                  ],
                  emergency: [
                    "Evacuate if advised for health.",
                    "Use HEPA filters if available.",
                    "Call 000 for breathing issues.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "transportAndTravel",
        name: "Transport & Travel",
        description: "Transportation and travel disruptions",
        color: "#86DF9D",
        severityKeywords: {
          unknown: [],
          info: ["traffic alert", "minor delay", "roadworks"],
          advice: ["significant delay", "seek alternate route", "avoid area"],
          watchAndAct: [
            "major disruption",
            "road closed",
            "emergency services",
          ],
          emergency: [
            "catastrophic failure",
            "multiple casualties",
            "total closure",
          ],
        },
        callToActions: {
          info: [
            "Allow extra travel time.",
            "Check traffic updates.",
            "Use alternate routes if available.",
          ],
          advice: [
            "Avoid the affected route.",
            "Use public transport alternatives.",
            "Plan different journey times.",
          ],
          watchAndAct: [
            "Find alternate routes immediately.",
            "Stay clear of emergency vehicles.",
            "Follow official traffic diversions.",
          ],
          emergency: [
            "Avoid area completely.",
            "Follow evacuation routes if directed.",
            "Allow emergency services access.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "carCrash" },
              create: {
                id: "carCrash",
                name: "Car Crash",
                description: "Vehicle accidents and collisions",
                severityKeywords: {
                  unknown: ["not applicable"],
                  info: [
                    "minor bingle",
                    "no injuries",
                    "exchange details",
                    "minor crash",
                    "fender bender",
                    "traffic incident no injuries",
                    "debris on road",
                  ],
                  advice: [
                    "single-vehicle crash",
                    "minor injuries",
                    "roadside assistance",
                    "lane blocked",
                    "tow en route",
                  ],
                  watchAndAct: [
                    "multi-vehicle crash",
                    "entrapment suspected",
                    "serious injuries",
                    "rescue responding",
                    "cordon in place",
                  ],
                  emergency: [
                    "mass-casualty",
                    "vehicle fire",
                    "multiple entrapments/fatalities",
                    "complex rescue",
                    "life-threatening injuries",
                    "fuel tanker rollover/leak",
                    "evacuate/shelter in place",
                  ],
                },
                callToActions: {
                  info: [
                    "Slow down near scene.",
                    "Don't film or block responders.",
                    "Keep emergency lane clear.",
                    "Expect minor traffic delays.",
                  ],
                  advice: [
                    "Use alternate route.",
                    "Allow emergency access.",
                    "Switch headlights on in poor visibility.",
                    "Stay alert for debris.",
                  ],
                  watchAndAct: [
                    "Avoid the area entirely.",
                    "Follow police diversions.",
                    "Report hazards (spilled fuel, debris) if first on scene.",
                    "Don't attempt rescue unless trained.",
                  ],
                  emergency: [
                    "Evacuate area if directed.",
                    "Stay clear of smoke or fire.",
                    "Use alternate route and monitor updates.",
                    "Call 000 only if you witness a new danger.",
                  ],
                },
              },
            },
            {
              where: { id: "vehicleFire" },
              create: {
                id: "vehicleFire",
                name: "Vehicle Fire",
                description: "Fires involving vehicles",
                severityKeywords: {
                  unknown: ["not applicable"],
                  info: ["small fire", "under control", "no injuries"],
                  advice: [
                    "significant fire",
                    "road closed",
                    "emergency services",
                  ],
                  watchAndAct: [
                    "major fire",
                    "explosion risk",
                    "multiple vehicles",
                  ],
                  emergency: [
                    "catastrophic fire",
                    "mass casualty",
                    "highway closure",
                  ],
                },
                callToActions: {
                  info: [
                    "Keep safe distance from scene.",
                    "Avoid inhaling smoke.",
                    "Don't film or block emergency access.",
                  ],
                  advice: [
                    "Use alternate route.",
                    "Stay upwind of smoke.",
                    "Follow police diversions.",
                  ],
                  watchAndAct: [
                    "Evacuate immediate area.",
                    "Stay clear of potential explosion zone.",
                    "Follow emergency service directions.",
                  ],
                  emergency: [
                    "Leave area immediately.",
                    "Avoid entire highway section.",
                    "Follow emergency evacuation routes.",
                  ],
                },
              },
            },
            {
              where: {
                id: "publicTransportCrowding",
              },
              create: {
                id: "publicTransportCrowding",
                name: "Public Transport Crowding",
                description: "Crowding on public transport",
                severityKeywords: {
                  info: [
                    "high passenger numbers",
                    "peak-hour demand",
                    "event-related travel",
                    "station busy",
                    "additional services operating",
                  ],
                  advice: [
                    "platform congestion",
                    "long queues",
                    "service delays",
                    "trains full",
                    "minor crowding",
                    "staff on-site managing flow",
                  ],
                  watchAndAct: [
                    "overcrowded platform",
                    "passengers spilling onto track area",
                    "emergency stop",
                    "crowd pushing",
                    "partial station closure",
                    "police attendance",
                  ],
                  emergency: [
                    "crush incident",
                    "passenger collapse",
                    "evacuation ordered",
                    "mass panic",
                    "multiple injuries",
                    "service suspension",
                    "emergency response activate",
                  ],
                },
                callToActions: {
                  info: [
                    "Allow extra travel time.",
                    "Stand behind safety lines.",
                    "Keep belongings secure.",
                    "Let passengers off before boarding.",
                  ],
                  advice: [
                    "Move to less crowded carriages.",
                    "Follow platform staff directions.",
                    "Avoid edge until train stops.",
                    "Stay patient — delays reduce risk.",
                  ],
                  watchAndAct: [
                    "Step off crowded train if feeling unwell.",
                    "Report fainting or distress to staff.",
                    "Avoid pushing when doors open.",
                    "Seek fresh air areas.",
                  ],
                  emergency: [
                    "Follow emergency exit lights.",
                    "Move calmly toward signed exits.",
                    "Avoid using escalators during rush.",
                    "Assist others only if safe.",
                  ],
                },
              },
            },
            {
              where: {
                id: "venueEvacuation",
              },
              create: {
                id: "venueEvacuation",
                name: "Venue Evacuation",
                description: "Evacuation of public venues",
                severityKeywords: {
                  info: [
                    "evacuation drill",
                    "test alarm",
                    "safety briefing",
                    "assembly area signage",
                    "staff familiarisation",
                  ],
                  advice: [
                    "false alarm",
                    "small fire / technical issue",
                    "single section evacuated",
                    "all-clear pending",
                  ],
                  watchAndAct: [
                    "smoke or power outage",
                    "medical emergency requiring crowd movement",
                    "alarm activation with crowd control",
                    "partial venue cleared",
                    "emergency services attending",
                  ],
                  emergency: [
                    "full stadium evacuation",
                    "panic crowd movement",
                    "structural failure",
                    "explosion / active threat",
                    "multiple casualties",
                    "incident command established",
                  ],
                },
                callToActions: {
                  info: [
                    "Know exit routes.",
                    "Don't use lifts.",
                    "Identify nearest assembly point.",
                  ],
                  advice: [
                    "Follow staff directions calmly.",
                    "Move away from affected area.",
                    "Take personal belongings if close by.",
                    "Wait for all-clear before returning.",
                  ],
                  watchAndAct: [
                    "Stay low if smoky.",
                    "Move quickly to stairs.",
                    "Help anyone needing assistance.",
                    "Keep doors closed behind you.",
                  ],
                  emergency: [
                    "Leave immediately via nearest exit.",
                    "Avoid elevators and interior corridors.",
                    "Do not re-enter until cleared by emergency services.",
                    "Head to designated safe assembly zone.",
                  ],
                },
              },
            },
            {
              where: {
                id: "waterOverRoad",
              },
              create: {
                id: "waterOverRoad",
                name: "Water Over Road",
                description: "Flooded roads and water hazards",
                severityKeywords: {
                  unknown: [],
                  info: ["water on road", "minor flooding", "caution advised"],
                  advice: [
                    "significant flooding",
                    "seek alternate route",
                    "avoid flooded areas",
                  ],
                  watchAndAct: [
                    "major flooding",
                    "road closed",
                    "emergency services",
                  ],
                  emergency: [
                    "catastrophic flooding",
                    "mass evacuation",
                    "life-threatening",
                  ],
                },
                callToActions: {
                  info: [
                    "Slow down and use caution.",
                    "Avoid puddles if possible.",
                    "Turn on headlights.",
                  ],
                  advice: [
                    "Turn around, don't drown.",
                    "Use alternate route.",
                    "Never drive through flood water.",
                  ],
                  watchAndAct: [
                    "Avoid area completely.",
                    "Follow road closure signs.",
                    "Move to higher ground if trapped.",
                  ],
                  emergency: [
                    "Evacuate immediately if directed.",
                    "Stay on high ground.",
                    "Call 000 if vehicle trapped in water.",
                  ],
                },
              },
            },
            {
              where: { id: "roadClosure" },
              create: {
                id: "roadClosure",
                name: "Road Closure",
                description: "Road blocks and closures",
                severityKeywords: {
                  unknown: [],
                  info: ["planned closure", "roadworks", "short term"],
                  advice: [
                    "road closed",
                    "detour required",
                    "significant delay",
                  ],
                  watchAndAct: [
                    "major closure",
                    "no alternate route",
                    "emergency",
                  ],
                  emergency: [
                    "indefinite closure",
                    "bridge collapse",
                    "catastrophic failure",
                  ],
                },
                callToActions: {
                  info: [
                    "Plan alternate route.",
                    "Allow extra travel time.",
                    "Follow detour signs.",
                  ],
                  advice: [
                    "Use GPS for alternate routes.",
                    "Avoid area if possible.",
                    "Check traffic updates regularly.",
                  ],
                  watchAndAct: [
                    "Find alternate transport.",
                    "Delay non-essential travel.",
                    "Follow official updates.",
                  ],
                  emergency: [
                    "Avoid region entirely.",
                    "Use emergency routes only if directed.",
                    "Follow evacuation procedures if needed.",
                  ],
                },
              },
            },
            {
              where: { id: "busBreakdown" },
              create: {
                id: "busBreakdown",
                name: "Bus Breakdown",
                description: "Bus breakdowns and service disruptions",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "bus delayed",
                    "mechanical issue",
                    "awaiting replacement",
                  ],
                  advice: [
                    "minor breakdown",
                    "passengers safe",
                    "alternate service arranged",
                  ],
                  watchAndAct: [
                    "bus collision/minor crash",
                    "road blocked",
                    "passengers treated",
                  ],
                  emergency: [
                    "major bus crash",
                    "multiple injuries",
                    "entrapments",
                    "emergency services on scene",
                  ],
                },
                callToActions: {
                  info: [
                    "Check app for revised timetable.",
                    "Remain patient and in safe area.",
                    "Carry water in hot weather.",
                  ],
                  advice: [
                    "Stay clear of roadway.",
                    "Follow driver's instructions.",
                    "Do not step onto road.",
                  ],
                  watchAndAct: [
                    "Move to safe waiting area.",
                    "Assist others only if directed.",
                    "Report hazards to 000.",
                    "Expect diversions.",
                  ],
                  emergency: [
                    "Avoid area.",
                    "Allow emergency access.",
                    "Don't share unverified images.",
                    "Follow emergency alerts.",
                  ],
                },
              },
            },
            {
              where: { id: "trafficSignalFailure" },
              create: {
                id: "trafficSignalFailure",
                name: "Traffic Signal Failure",
                description: "Failures of traffic signals and lights",
                severityKeywords: {
                  unknown: [],
                  info: ["temporary outage", "maintenance", "flashing amber"],
                  advice: [
                    "single intersection out",
                    "minor traffic delays",
                    "crew notified",
                  ],
                  watchAndAct: [
                    "multiple lights blacked out",
                    "congestion",
                    "police directing traffic",
                  ],
                  emergency: [
                    "major corridor outage",
                    "city-wide signal failure",
                    "crash risk",
                    "extreme congestion",
                  ],
                },
                callToActions: {
                  info: [
                    "Slow down on approach.",
                    "Treat flashing amber as give-way.",
                    "Obey temporary signage.",
                  ],
                  advice: [
                    "Allow extra time.",
                    "Be cautious at crossings.",
                    "Watch for pedestrians.",
                  ],
                  watchAndAct: [
                    "Treat all as four-way stops.",
                    "Avoid CBD routes.",
                    "Follow police direction.",
                    "Use headlights.",
                  ],
                  emergency: [
                    "Avoid entire zone.",
                    "Use alternate transport.",
                    "Allow emergency vehicles right-of-way.",
                    "Expect extended delays.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "infrastructureAndServices",
        name: "Infrastructure & Services",
        description: "Infrastructure failures and service disruptions",
        color: "#FFE47A",
        severityKeywords: {
          unknown: [],
          info: ["service alert", "maintenance", "minor disruption"],
          advice: [
            "service outage",
            "significant disruption",
            "seek alternatives",
          ],
          watchAndAct: [
            "major failure",
            "widespread outage",
            "emergency response",
          ],
          emergency: [
            "catastrophic failure",
            "life threatening",
            "total system failure",
          ],
        },
        callToActions: {
          info: [
            "Monitor service updates.",
            "Prepare for possible disruptions.",
            "Have backup plans ready.",
          ],
          advice: [
            "Use alternative services.",
            "Conserve resources.",
            "Check service provider updates.",
          ],
          watchAndAct: [
            "Implement backup plans.",
            "Report outages to authorities.",
            "Prepare for extended disruption.",
          ],
          emergency: [
            "Evacuate if services critical to safety.",
            "Call emergency services if life threatening.",
            "Follow official emergency procedures.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "structuralFire" },
              create: {
                id: "structuralFire",
                name: "Structural Fire",
                description: "Fires in buildings and structures",
                severityKeywords: {
                  unknown: ["not applicable"],
                  info: [
                    "smoke sighted",
                    "small contained fire",
                    "appliance responding",
                    "false alarm",
                    "alarm activation",
                    "smoke in building",
                    "evacuation complete",
                    "no threat to public",
                  ],
                  advice: [
                    "fire contained to single room/appliance",
                    "minor structure damage",
                    "sprinkler activation",
                    "small internal blaze",
                    "ventilation required",
                  ],
                  watchAndAct: [
                    "visible flames",
                    "multiple rooms alight",
                    "roof space involvement",
                    "adjoining properties threatened",
                    "partial collapse risk",
                    "multiple crews responding",
                    "still not contained",
                  ],
                  emergency: [
                    "catastrophic fire",
                    "fully involved structure",
                    "building collapse imminent or occurred",
                    "multiple structures affected",
                    "hazardous materials inside",
                    "explosions/gas cylinders",
                    "life-threatening conditions",
                    "evacuate immediately",
                    "multiple casualties",
                    "major urban fire incident",
                  ],
                },
                callToActions: {
                  info: [
                    "Keep clear of area.",
                    "Avoid inhaling smoke.",
                    "Close nearby windows.",
                    "Don't block hydrants or driveways.",
                  ],
                  advice: [
                    "Expect traffic delays.",
                    "Avoid rooftop viewing or filming.",
                    "Watch for falling embers if nearby.",
                    "Follow police cordons.",
                  ],
                  watchAndAct: [
                    "Evacuate nearby buildings.",
                    "Stay low if smoke enters room.",
                    "Move vehicles away.",
                    "Assist vulnerable neighbours.",
                  ],
                  emergency: [
                    "Leave area immediately.",
                    "Keep 200 m clear.",
                    "Beware of explosion risk.",
                    "Report anyone unaccounted for to 000.",
                  ],
                },
              },
            },
            {
              where: { id: "chemicalSpill" },
              create: {
                id: "chemicalSpill",
                name: "Chemical Spill",
                description: "Spills of hazardous chemicals",
                severityKeywords: {
                  info: [
                    "small spill contained",
                    "absorbent applied",
                    "no vapour risk",
                  ],
                  advice: [
                    "minor irritant exposure",
                    "localised cleanup",
                    "isolate area",
                    "PPE required",
                  ],
                  watchAndAct: [
                    "hazardous vapours",
                    "decontamination set-up",
                    "evacuate immediate area",
                    "off-gassing",
                  ],
                  emergency: [
                    "toxic release",
                    "plume impacting public",
                    "mass decon",
                    "shelter-in-place/evacuate",
                    "life-threatening exposure",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid area.",
                    "Don't handle unknown materials.",
                    "Report strange smells.",
                  ],
                  advice: [
                    "Close doors/windows.",
                    "Turn off air-conditioning.",
                    "Move pets indoors.",
                    "Stay upwind if outside.",
                  ],
                  watchAndAct: [
                    "Leave quickly by crosswind route.",
                    "Avoid touching contaminated surfaces.",
                    "Wash skin if exposed.",
                    "Listen for decontamination sites.",
                  ],
                  emergency: [
                    "Seal gaps with wet towels.",
                    "Shut all ventilation.",
                    "Stay tuned for emergency broadcast.",
                    "Seek medical attention if breathing difficulty.",
                  ],
                },
              },
            },
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
                severityKeywords: {
                  info: [
                    "unknown odour investigation",
                    "precautionary monitoring",
                    "readings negative",
                  ],
                  advice: [
                    "low-level readings",
                    "product identified + contained",
                    "limited exclusion zone",
                  ],
                  watchAndAct: [
                    "escalating readings",
                    "expanding exclusion zone",
                    "multi-agency response",
                    "decon corridor",
                  ],
                  emergency: [
                    "significant leak/explosion risk",
                    "BLEVE risk",
                    "large plume",
                    "mass evacuation/shelter-in-place",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid area as precaution.",
                    "Report unusual odors to authorities.",
                    "Stay upwind if nearby.",
                  ],
                  advice: [
                    "Leave area immediately.",
                    "Close windows and doors.",
                    "Avoid touching contaminated surfaces.",
                  ],
                  watchAndAct: [
                    "Evacuate if in exclusion zone.",
                    "Follow decontamination procedures if exposed.",
                    "Shelter in place if unable to evacuate.",
                  ],
                  emergency: [
                    "Follow evacuation orders immediately.",
                    "Seek medical attention if exposed.",
                    "Stay tuned to emergency broadcasts.",
                  ],
                },
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
                severityKeywords: {
                  info: ["planned outage"],
                  advice: ["unplanned local"],
                  watchAndAct: ["widespread outage/service suspended"],
                  emergency: ["load shedding/network failure"],
                },
                callToActions: {
                  info: [
                    "Charge phones and devices.",
                    "Switch off sensitive electronics.",
                    "Prepare torches and batteries.",
                  ],
                  advice: [
                    "Keep fridge/freezer closed.",
                    "Use torches not candles.",
                    "Unplug appliances to avoid surges.",
                  ],
                  watchAndAct: [
                    "Check on elderly neighbours.",
                    "Keep mobile devices charged via car.",
                    "Stay warm/cool depending on weather.",
                    "Follow official restoration updates.",
                  ],
                  emergency: [
                    "Conserve fuel and battery power.",
                    "Use generators outdoors only.",
                    "Move to evacuation centre if medically dependent on power.",
                    "Follow emergency broadcasts.",
                  ],
                },
              },
            },
            {
              where: { id: "waterIssue" },
              create: {
                id: "waterIssue",
                name: "Water Issue",
                description: "Water supply issues",
                severityKeywords: {
                  info: ["low pressure"],
                  advice: ["main burst", "boil water as precaution"],
                  watchAndAct: ["boil water notice"],
                  emergency: ["do not drink", "contamination confirmed"],
                },
                callToActions: {
                  info: [
                    "Store a small supply of clean water.",
                    "Check taps for discolouration after works.",
                    "Avoid washing clothes until flow stabilises.",
                  ],
                  advice: [
                    "Boil tap water for one minute before drinking.",
                    "Avoid using dishwashers until clear.",
                    "Follow updates from water utility.",
                  ],
                  watchAndAct: [
                    "Use bottled water for infants.",
                    "Disinfect cooking surfaces.",
                    "Avoid brushing teeth with tap water.",
                    "Check social media for pickup sites.",
                  ],
                  emergency: [
                    "Use bottled or tanker-supplied water only.",
                    "Don't bathe infants in tap water.",
                    "Collect water from safe supply points.",
                    "Follow health department alerts.",
                  ],
                },
              },
            },
            {
              where: { id: "gasLeak" },
              create: {
                id: "gasLeak",
                name: "Gas Leak",
                description: "Natural gas leaks and related hazards",
                severityKeywords: {
                  info: ["odour investigations"],
                  advice: ["leak cordon"],
                  watchAndAct: ["major leak", "avoid area"],
                  emergency: ["explosion risk", "evacuate"],
                },
                callToActions: {
                  info: [
                    "Check live traffic map.",
                    "Leave earlier.",
                    "Follow signage.",
                    "No action needed unless smell intensifies.",
                    "Keep ignition sources off.",
                    "Report strong odours to supplier.",
                  ],
                  advice: [
                    "Avoid area if possible.",
                    "Don't rubberneck.",
                    "Use detour routes.",
                    "Avoid open flames or sparks.",
                    "Ventilate area if indoors.",
                    "Move vehicles away.",
                    "Follow directions from crews.",
                  ],
                  watchAndAct: [
                    "Expect long delays.",
                    "Obey emergency controllers.",
                    "Use public transport where available.",
                    "Leave on foot, don't start engines.",
                    "Do not use phones near leak.",
                    "Warn neighbours calmly.",
                    "Wait 200 m away upwind.",
                  ],
                  emergency: [
                    "Avoid entirely.",
                    "Keep clear for emergency services.",
                    "Follow official reroute advice.",
                    "Evacuate immediately.",
                    "Avoid using switches or torches.",
                    "Stay behind emergency tape.",
                    "Only re-enter when authorities declare safe.",
                  ],
                },
              },
            },
            {
              where: { id: "industrialFire" },
              create: {
                id: "industrialFire",
                name: "Industrial Fire",
                description: "Fires at industrial facilities",
                severityKeywords: {
                  unknown: ["not applicable"],
                  info: ["alarm activated", "small fire", "investigating"],
                  advice: [
                    "facility fire",
                    "evacuating",
                    "toxic smoke possible",
                  ],
                  watchAndAct: [
                    "major industrial fire",
                    "explosion risk",
                    "evacuate area",
                  ],
                  emergency: [
                    "catastrophic fire",
                    "toxic release",
                    "widespread danger",
                  ],
                },
                callToActions: {
                  info: [
                    "Stay clear of facility.",
                    "Avoid downwind areas.",
                    "Monitor official updates.",
                  ],
                  advice: [
                    "Evacuate immediate area.",
                    "Close windows and doors.",
                    "Avoid inhaling smoke.",
                  ],
                  watchAndAct: [
                    "Leave area immediately.",
                    "Stay at least 1km away.",
                    "Prepare for potential evacuation.",
                  ],
                  emergency: [
                    "Evacuate wide area immediately.",
                    "Seek shelter indoors if unable to evacuate.",
                    "Follow emergency service directions only.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "crowdsAndEvents",
        name: "Crowds & Events",
        description: "Large gatherings and crowd-related incidents",
        color: "#AB87F1",
        severityKeywords: {
          unknown: [],
          info: [
            "crowd gathering",
            "community event",
            "festival scheduled",
            "large crowd expected",
            "general event notification",
            "routine crowd management plan",
            "public assembly approved",
            "no incident reported",
            "traffic / pedestrian management in place",
          ],
          advice: [
            "busy crowd",
            "high attendance",
            "queues forming",
            "crowd density increasing",
            "congestion at entry / exit",
            "police / security monitoring",
            "delays reported",
            "low-risk demonstration",
            "public order maintained",
            "minor injuries / first aid only",
          ],
          watchAndAct: [
            "crowd pushing / surging",
            "overcrowding",
            "trampling risk",
            "evacuation of section",
            "people treated for crush injuries / heat stress",
            "aggressive behaviour",
            "fight / disturbance",
            "stage barrier breach",
            "crowd movement restricted",
            "emergency services requested",
            "partial venue evacuation",
          ],
          emergency: [
            "mass panic",
            "crowd collapse / stampede",
            "crush injuries multiple casualties",
            "full evacuation underway",
            "crowd control lost",
            "police emergency declared",
            "security incident in crowd",
            "active threat during event",
            "life-threatening crowd surge",
            "fatalities confirmed",
          ],
        },
        callToActions: {
          info: [
            "Plan arrival and exit routes.",
            "Keep belongings close and zipped.",
            "Stay hydrated and wear light clothing.",
            "Identify first-aid and exit locations early.",
            "Arrange a meeting point with companions.",
          ],
          advice: [
            "Stay near open space or perimeter edges.",
            "Avoid tight or fenced areas.",
            "Keep small children or friends in sight.",
            "Follow staff or security guidance.",
            "Avoid loud or aggressive groups.",
          ],
          watchAndAct: [
            "Move diagonally or sideways toward clear space.",
            "Don't push others; maintain breathing space.",
            "Drop any heavy bags if pressure builds.",
            "Support others struggling to move.",
            "Signal security if someone collapses.",
          ],
          emergency: [
            "Move sideways to exit pressure zones.",
            "Protect chest with bent arms to create space.",
            "Stay upright if possible — keep feet moving.",
            "Avoid fences, barriers, or solid walls.",
            "If you fall, curl into a ball and cover head until pressure eases.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestival" },
              create: {
                id: "concertFestival",
                name: "Concert/Festival",
                description: "Incidents at concerts and festivals",
                severityKeywords: {
                  info: [
                    "festival underway",
                    "large audience expected",
                    "gates open",
                    "event proceeding safely",
                    "crowd behaviour positive",
                  ],
                  advice: [
                    "high attendance",
                    "delays at gate",
                    "medical tents busy",
                    "intoxicated patrons",
                    "security managing crowd flow",
                    "minor scuffles",
                  ],
                  watchAndAct: [
                    "crowd pushing toward stage",
                    "dehydration / heat stress",
                    "fence collapse",
                    "partial evacuation",
                    "aggressive behaviour",
                    "first-aid overflow",
                  ],
                  emergency: [
                    "crowd crush / stampede",
                    "stage collapse",
                    "mass panic",
                    "multiple injuries",
                    "fatalities",
                    "full site evacuation",
                    "emergency declared",
                  ],
                },
                callToActions: {
                  info: [
                    "Check weather forecast and pack accordingly.",
                    "Stay hydrated and use sunscreen.",
                    "Identify exits and first-aid tents.",
                    "Agree on meeting point with friends.",
                  ],
                  advice: [
                    "Move away from front-of-stage barriers.",
                    "Avoid centre-pit areas if claustrophobic.",
                    "Keep awareness of crowd flow direction.",
                    "Report anyone who collapses to staff.",
                  ],
                  watchAndAct: [
                    "Leave dense areas immediately.",
                    "Stay alert for collapsing barriers or fencing.",
                    "Maintain breathing room; lift arms to protect chest.",
                    "Use exits or side walkways to move out.",
                  ],
                  emergency: [
                    "Follow emergency stewards to open zones.",
                    "Move diagonally with crowd flow, not against it.",
                    "Don't climb unstable structures.",
                    "Once safe, assist injured only if trained.",
                  ],
                },
              },
            },
            {
              where: { id: "protest" },
              create: {
                id: "protest",
                name: "Protest",
                description: "Public demonstrations and protests",
                severityKeywords: {
                  info: [
                    "authorised rally",
                    "peaceful protest",
                    "community march",
                    "traffic diversion in place",
                    "public notice issued",
                    "police liaison present",
                    "crowd expected",
                    "no disruption reported",
                  ],
                  advice: [
                    "large turnout",
                    "chanting crowd",
                    "slow traffic",
                    "temporary road closures",
                    "police managing flow",
                    "minor tension",
                    "localised congestion",
                  ],
                  watchAndAct: [
                    "scuffles",
                    "projectiles thrown",
                    "property damage",
                    "arrests made",
                    "pepper spray deployed",
                    "crowd refusing direction",
                    "heavy police presence",
                    "partial evacuation",
                    "barricades breached",
                  ],
                  emergency: [
                    "violent clashes",
                    "fires lit",
                    "mass arrests",
                    "multiple injuries",
                    "riot declaration",
                    "lethal weapons used",
                    "major property damage",
                    "curfew or emergency powers invoked",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid route unless participating.",
                    "Allow extra travel time.",
                    "Keep valuables secure.",
                    "Remain respectful if passing protesters.",
                  ],
                  advice: [
                    "Stay alert and calm.",
                    "Follow police instructions.",
                    "Avoid blocking emergency routes.",
                    "Move to safer side streets if tension rises.",
                  ],
                  watchAndAct: [
                    "Leave area immediately.",
                    "Do not film close-range conflicts.",
                    "Avoid tear gas or pepper-spray zones (move upwind).",
                    "Cover eyes and mouth with cloth if gas released.",
                  ],
                  emergency: [
                    "Shelter indoors away from windows.",
                    "Lock doors and stay off balconies.",
                    "Avoid all protest zones and large groups.",
                    "Follow local authority updates for curfews.",
                  ],
                },
              },
            },
            {
              where: { id: "largeSportingEvent" },
              create: {
                id: "largeSportingEvent",
                name: "Large Sporting Event",
                description: "Incidents at sporting venues and events",
                severityKeywords: {
                  info: [
                    "game day crowd",
                    "event expected to draw large attendance",
                    "stadium at capacity",
                    "routine crowd management plan",
                    "entry gates open",
                    "no incidents reported",
                  ],
                  advice: [
                    "queues forming",
                    "turnstile delays",
                    "minor disorder",
                    "alcohol-related behaviour",
                    "crowd congestion at exits",
                    "police/security patrols present",
                  ],
                  watchAndAct: [
                    "crowd pushing",
                    "minor fights",
                    "pitch invasion",
                    "barricade breach",
                    "heat illness in crowd",
                    "evacuation of section",
                    "injuries treated on scene",
                  ],
                  emergency: [
                    "crowd surge / crush injuries",
                    "large-scale panic",
                    "full evacuation ordered",
                    "structure failure (grandstand/fence)",
                    "multiple casualties",
                    "emergency services in command",
                  ],
                },
                callToActions: {
                  info: [
                    "Arrive early, avoid last-minute queues.",
                    "Identify exits and first-aid stations.",
                    "Keep tickets and ID handy.",
                    "Stay hydrated.",
                  ],
                  advice: [
                    "Wait patiently, don't push.",
                    "Follow staff direction.",
                    "Use alternate exits if available.",
                    "Keep children close.",
                  ],
                  watchAndAct: [
                    "Move to concourse or open stairwells.",
                    "Avoid alcohol-affected sections.",
                    "Inform security of unsafe behaviour.",
                    "Remain calm and walk, don't run.",
                  ],
                  emergency: [
                    "Follow PA and security directions only.",
                    "Move toward nearest open gate, avoid bottlenecks.",
                    "Protect your chest and head from impact.",
                    "Help those who fall once clear of main flow.",
                  ],
                },
              },
            },
          ],
        },
      },
      {
        id: "other",
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
        color: "#BAA27D",
        severityKeywords: {
          unknown: ["not applicable"],
          info: ["miscellaneous incident", "unclassified", "investigating"],
          advice: [
            "notable incident",
            "monitor situation",
            "potential concern",
          ],
          watchAndAct: [
            "significant incident",
            "action required",
            "serious concern",
          ],
          emergency: [
            "critical incident",
            "immediate action",
            "life threatening",
          ],
        },
        callToActions: {
          info: [
            "Stay informed about developments.",
            "Follow official updates.",
            "Take basic precautions.",
          ],
          advice: [
            "Monitor situation closely.",
            "Take recommended precautions.",
            "Avoid affected areas if advised.",
          ],
          watchAndAct: [
            "Take immediate precautionary action.",
            "Follow official guidance.",
            "Prepare for potential escalation.",
          ],
          emergency: [
            "Take immediate protective action.",
            "Follow emergency procedures.",
            "Call emergency services if needed.",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "algaeBloom" },
              create: {
                id: "algaeBloom",
                name: "Algae Bloom",
                description: "Harmful algal blooms in water bodies",
                severityKeywords: {
                  info: [
                    "routine water testing",
                    "low algae detected",
                    "monitoring in progress",
                    "no restrictions",
                  ],
                  advice: [
                    "minor bloom forming",
                    "advisory for pets/livestock",
                    "avoid direct contact",
                    "visual discoloration/scum",
                  ],
                  watchAndAct: [
                    "confirmed toxic bloom",
                    "strong odour",
                    "fish deaths",
                    "avoid swimming/drinking",
                    "warning issued",
                  ],
                  emergency: [
                    "extensive toxic bloom",
                    "waterway closure",
                    "human/animal illness reported",
                    "alternate water supply required",
                  ],
                },
                callToActions: {
                  info: [
                    "Avoid drinking untreated water.",
                    "Keep pets from ponds.",
                    "Report fish deaths.",
                  ],
                  advice: [
                    "Don't swim or fish.",
                    "Prevent livestock access.",
                    "Avoid skin contact with scum.",
                  ],
                  watchAndAct: [
                    "Don't use water for cooking or bathing.",
                    "Use alternate water sources.",
                    "Avoid eating local fish or shellfish.",
                  ],
                  emergency: [
                    "Stay completely out of water.",
                    "Follow local closure signs.",
                    "Seek medical help if rash or nausea after contact.",
                    "Use bottled water until lifted.",
                  ],
                },
              },
            },
            {
              where: { id: "electricalHazard" },
              create: {
                id: "electricalHazard",
                name: "Electrical Hazard",
                description: "Incidents involving electrical hazards",
                severityKeywords: {
                  info: [
                    "routine powerline inspection",
                    "vegetation contact cleared",
                  ],
                  advice: [
                    "wires down on verge/fence",
                    "no live hazard confirmed",
                    "crew attending",
                  ],
                  watchAndAct: [
                    "live powerlines across road/vehicle",
                    "fire risk",
                    "area cordoned off",
                    "traffic disruption",
                  ],
                  emergency: [
                    "multiple live wires down",
                    "electrocution risk",
                    "structure involved",
                    "widespread outage/fire ignition potential",
                  ],
                },
                callToActions: {
                  info: [
                    "Report sparking lines to utility.",
                    "Keep 8 m distance from poles.",
                    "Don't spray water near lines.",
                  ],
                  advice: [
                    "Stay at least 8 m away.",
                    "Warn others to keep clear.",
                    "Don't drive over fallen lines.",
                    "Call 000 if area unsafe.",
                  ],
                  watchAndAct: [
                    "Treat all downed lines as live.",
                    "Keep kids and pets indoors.",
                    "Avoid touching metal fences nearby.",
                    "Wait for official all-clear.",
                  ],
                  emergency: [
                    "Evacuate area immediately.",
                    "Do not approach rescue scene.",
                    "Inform authorities of fires sparked.",
                    "Stay off wet ground near lines.",
                  ],
                },
              },
            },
            {
              where: { id: "sharkSighting" },
              create: {
                id: "sharkSighting",
                name: "Shark Sighting",
                description: "Reports of shark sightings in water bodies",
                severityKeywords: {
                  info: [],
                },
                callToActions: {
                  info: [
                    "Avoid murky water.",
                    "Don’t swim with fish schools.",
                    "Leave water immediately.",
                    "Follow lifeguard advice.",
                    "Don’t re-enter until reopened.",
                    "Avoid entire coastal area.",
                    "Move to patrolled beach later.",
                    "Alert others nearby.",
                    "Stay out of water completely.",
                    "Follow official closures.",
                    "Support emergency responders with space.",
                  ],
                },
              },
            },
            {
              where: { id: "evacuationCenter" },
              create: {
                id: "evacuationCenter",
                name: "Evacuation Center",
                description: "Designated evacuation centers during emergencies",
                severityKeywords: {
                  info: [],
                },
                callToActions: {
                  info: [
                    "Bring pets in carrier if allowed.",
                    "Register with authorities.",
                    "Head to alternate centre if directed.",
                    "Travel early to avoid congestion.",
                    "Follow directions from staff.",
                    "Remain patient and calm.",
                    "Keep valuables with you.",
                    "Stay in contact with emergency services.",
                  ],
                },
              },
            },
          ],
        },
      },
    ];

    const createdCategories = [];

    for (const categoryData of categories) {
      if (categoryData.id) {
        // First, upsert the main category without subcategories
        const { subCategories, ...mainCategoryData } = categoryData;

        const upsertedCategory: HazardCategory & {
          subCategories?: HazardCategory[];
        } = await prisma.hazardCategory.upsert({
          where: { id: categoryData.id },
          update: mainCategoryData, // Update main category fields
          create: mainCategoryData, // Create main category fields only
        });

        // Then handle subcategories separately if they exist
        if (
          subCategories &&
          "connectOrCreate" in subCategories &&
          Array.isArray(subCategories.connectOrCreate)
        ) {
          for (const subCategoryData of subCategories.connectOrCreate) {
            const subCategoryId = subCategoryData.where.id;
            if (subCategoryId) {
              const upsertedSubCategory = await prisma.hazardCategory.upsert({
                where: { id: subCategoryId },
                update: {
                  ...subCategoryData.create,
                  parentId: upsertedCategory.id, // Ensure parent relationship
                },
                create: {
                  ...subCategoryData.create,
                  parentId: upsertedCategory.id, // Ensure parent relationship
                },
              });

              upsertedCategory.subCategories =
                upsertedCategory.subCategories || [];
              upsertedCategory.subCategories?.push(upsertedSubCategory);
            }
          }
        }

        createdCategories.push(upsertedCategory);
      }
    }

    console.log(
      `------------------------------------> Populated ${createdCategories.length} hazard categories.`,
      JSON.stringify(createdCategories, null, 2)
    );

    return createdCategories;
  } catch (error) {
    console.error("Error populating hazard categories:", error);
    throw error;
  }
};

/**
 * Get all sub-categories from the database.
 */
export const getAllSubHazardCategories = async () => {
  const subCategories = await prisma.hazardCategory.findMany({
    where: {
      parentId: { not: null },
    },
  });
  return subCategories;
};

/**
 * Get categories applying the specified filters.
 */
export const getCategoriesApplyingFilters = async ({
  hazardSearchString,
  hazardSeverities,
  hazardReviewStatus,
  hazardReportedById,
  hazardNortheastLat,
  hazardNortheastLng,
  hazardSouthwestLat,
  hazardSouthwestLng,
  showExpiredHazards,
  subscriptions,
}: {
  hazardSearchString?: string | undefined;
  hazardSeverities?: HazardSeverityWithAwsCompliant | undefined;
  hazardReviewStatus?: HazardReviewStatus | undefined;
  hazardReportedById?: string | undefined;
  hazardNortheastLat?: number | undefined;
  hazardNortheastLng?: number | undefined;
  hazardSouthwestLat?: number | undefined;
  hazardSouthwestLng?: number | undefined;
  showExpiredHazards?: boolean | undefined;
  subscriptions?: LocationSubscription[] | undefined;
}) => {
  const hazardsWhereClause = buildHazardsWhereClause({
    searchString: hazardSearchString,
    severityFilter: hazardSeverities,
    reviewStatus: hazardReviewStatus,
    reportedById: hazardReportedById,
    northeastLat: hazardNortheastLat,
    northeastLng: hazardNortheastLng,
    southwestLat: hazardSouthwestLat,
    southwestLng: hazardSouthwestLng,
    showExpired: showExpiredHazards,
    subscriptions,
  });

  const categories = await prisma.hazardCategory.findMany({
    where: {
      parentId: null, // Only parent categories
      OR: [
        { hazards: { some: hazardsWhereClause } }, // Parent category has hazards
        { subCategories: { some: { hazards: { some: hazardsWhereClause } } } }, // Subcategories have hazards
      ],
    },
    include: {
      _count: {
        select: {
          hazards: {
            where: hazardsWhereClause,
          },
        },
      },
      subCategories: {
        include: {
          _count: {
            select: {
              hazards: {
                where: hazardsWhereClause,
              },
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const transformedCategories = categories
    .map((category) => {
      // Calculate total hazards count (parent + all subcategories)
      const parentHazardsCount = category._count.hazards;
      const subCategoriesHazardsCount = category.subCategories.reduce(
        (total, subCategory) => total + subCategory._count.hazards,
        0
      );
      const totalHazardsCount = parentHazardsCount + subCategoriesHazardsCount;

      return {
        ...category,
        hazardsCount: totalHazardsCount,
        _count: undefined,
        subCategories: undefined, // Remove subcategories from response to keep it clean
      };
    })
    .filter((category) => category.hazardsCount > 0) // Only return categories with hazards
    .sort((a, b) => b.hazardsCount - a.hazardsCount); // Sort by hazards count descending

  return transformedCategories;
};
