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
          low: ["minor incident", "resolved", "all clear"],
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
              },
            },
            {
              where: { id: "fight" },
              create: {
                id: "fight",
                name: "Fight",
                description: "Physical altercations and brawls",
                severityKeywords: {
                  unknown: [],
                  info: ["verbal argument", "tension", "dispute"],
                  low: ["minor scuffle", "broken up", "no injuries"],
                  advice: [
                    "physical altercation",
                    "avoid area",
                    "police responding",
                  ],
                  watchAndAct: [
                    "large brawl",
                    "weapons involved",
                    "injuries reported",
                  ],
                  emergency: [
                    "mass brawl",
                    "serious injuries",
                    "life threatening",
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
              },
            },
            {
              where: { id: "riot" },
              create: {
                id: "riot",
                name: "Riot",
                description: "Civil disorder and violent public disturbances",
                severityKeywords: {
                  unknown: [],
                  info: ["protest", "gathering", "peaceful demonstration"],
                  low: ["dispersed", "peaceful", "no incidents"],
                  advice: ["unrest", "property damage", "avoid area"],
                  watchAndAct: ["violent clashes", "looting", "fires"],
                  emergency: [
                    "widespread violence",
                    "major destruction",
                    "lives at risk",
                  ],
                },
              },
            },
            {
              where: { id: "policeLockdown" },
              create: {
                id: "policeLockdown",
                name: "Police Lockdown",
                description: "Law enforcement security measures",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "increased patrols",
                    "routine security",
                    "precautionary",
                  ],
                  low: ["minor incident", "traffic stop", "resolved"],
                  advice: [
                    "area secured",
                    "investigation ongoing",
                    "movement restricted",
                  ],
                  watchAndAct: ["manhunt", "dangerous suspect", "stay indoors"],
                  emergency: [
                    "armed suspect",
                    "hostage situation",
                    "immediate threat",
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
          unknown: [],
          info: ["health advisory", "monitoring", "precautionary"],
          low: ["minor incident", "treated", "no serious injuries"],
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
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "diseaseOutbreak" },
              create: {
                id: "diseaseOutbreak",
                name: "Disease Outbreak",
                description: "Infectious disease outbreaks and epidemics",
                severityKeywords: {
                  unknown: [],
                  info: ["monitoring", "isolated cases", "investigation"],
                  low: ["contained", "no new cases", "under control"],
                  advice: [
                    "increasing cases",
                    "vaccination recommended",
                    "take precautions",
                  ],
                  watchAndAct: [
                    "rapid spread",
                    "community transmission",
                    "quarantine measures",
                  ],
                  emergency: [
                    "pandemic",
                    "hospital overwhelmed",
                    "widespread transmission",
                  ],
                },
              },
            },
            {
              where: { id: "medicalEmergency" },
              create: {
                id: "medicalEmergency",
                name: "Medical Emergency",
                description: "Serious medical situations requiring urgent care",
                severityKeywords: {
                  unknown: [],
                  info: ["medical assistance", "non-urgent", "routine"],
                  low: ["minor injury", "treated", "discharged"],
                  advice: [
                    "serious condition",
                    "hospital required",
                    "multiple patients",
                  ],
                  watchAndAct: [
                    "critical condition",
                    "life support",
                    "emergency surgery",
                  ],
                  emergency: [
                    "cardiac arrest",
                    "multiple casualties",
                    "mass medical event",
                  ],
                },
              },
            },
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
              },
            },
            {
              where: { id: "chemicalExposure" },
              create: {
                id: "chemicalExposure",
                name: "Chemical Exposure",
                description: "Exposure to hazardous chemicals",
                severityKeywords: {
                  unknown: [],
                  info: ["chemical detected", "low levels", "monitoring"],
                  low: ["minor exposure", "decontaminated", "no symptoms"],
                  advice: [
                    "hazardous levels",
                    "evacuation zone",
                    "seek shelter",
                  ],
                  watchAndAct: [
                    "toxic cloud",
                    "widespread exposure",
                    "immediate evacuation",
                  ],
                  emergency: [
                    "lethal concentration",
                    "mass poisoning",
                    "environmental disaster",
                  ],
                },
              },
            },
            {
              where: { id: "foodPoisoning" },
              create: {
                id: "foodPoisoning",
                name: "Food Poisoning",
                description: "Foodborne illness incidents",
                severityKeywords: {
                  unknown: [],
                  info: ["investigation", "isolated case", "testing"],
                  low: ["single case", "mild symptoms", "recovered"],
                  advice: [
                    "multiple cases",
                    "restaurant closure",
                    "avoid consumption",
                  ],
                  watchAndAct: [
                    "widespread illness",
                    "hospitalization",
                    "source identified",
                  ],
                  emergency: [
                    "mass outbreak",
                    "deaths reported",
                    "contaminated supply",
                  ],
                },
              },
            },
            {
              where: { id: "heatwaveSickness" },
              create: {
                id: "heatwaveSickness",
                name: "Heatwave Sickness",
                description: "Heat-related health emergencies",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "heat advisory",
                    "stay hydrated",
                    "monitor vulnerable",
                  ],
                  low: ["mild symptoms", "treated", "cooling centers open"],
                  advice: [
                    "heat exhaustion",
                    "multiple cases",
                    "seek air conditioning",
                  ],
                  watchAndAct: [
                    "heat stroke",
                    "hospital admissions",
                    "extreme temperatures",
                  ],
                  emergency: [
                    "mass heat casualties",
                    "overwhelming hospitals",
                    "deadly temperatures",
                  ],
                },
              },
            },
            {
              where: { id: "massCasualtyEvent" },
              create: {
                id: "massCasualtyEvent",
                name: "Mass Casualty Event",
                description: "Large-scale emergency with multiple victims",
                severityKeywords: {
                  unknown: [],
                  info: ["incident reported", "assessing", "initial response"],
                  low: [
                    "minor injuries",
                    "walking wounded",
                    "controlled scene",
                  ],
                  advice: ["multiple injuries", "triage", "hospital alert"],
                  watchAndAct: [
                    "serious casualties",
                    "overwhelmed services",
                    "disaster declared",
                  ],
                  emergency: [
                    "mass fatalities",
                    "catastrophic event",
                    "total system failure",
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
          low: ["cleared", "weakening", "minimal impact"],
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
                  unknown: ["not applicable"],
                  info: ["info", "information"],
                  advice: ["advice"],
                  watchAndAct: ["watch and act", "watchAndAct"],
                  emergency: [
                    "emergency",
                    "emergency warning",
                    "emergencyWarning",
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
              },
            },
            {
              where: { id: "volcanicActivity" },
              create: {
                id: "volcanicActivity",
                name: "Volcanic Activity",
                description: "Volcanic eruptions and ash fall",
                severityKeywords: {
                  unknown: [],
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
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                severityKeywords: {
                  unknown: [],
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
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
                severityKeywords: {
                  unknown: [],
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
              },
            },
            {
              where: { id: "heavyRain" },
              create: {
                id: "heavyRain",
                name: "Heavy Rain",
                description: "Intense rainfall and precipitation",
                severityKeywords: {
                  unknown: [],
                  info: ["rain developing", "showers", "light rain"],
                  advice: [
                    "heavy rain",
                    "flooding possible",
                    "drive carefully",
                  ],
                  watchAndAct: [
                    "intense rainfall",
                    "flash flooding",
                    "dangerous driving",
                  ],
                  emergency: [
                    "extreme rainfall",
                    "catastrophic flooding",
                    "life threatening",
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
                  low: ["clearing smoke", "improving", "minimal"],
                  advice: ["thick smoke", "poor visibility", "stay indoors"],
                  watchAndAct: ["heavy smoke", "dangerous air", "health risk"],
                  emergency: [
                    "extreme smoke",
                    "zero visibility",
                    "immediate health threat",
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
                  unknown: [],
                  info: ["air quality alert", "monitoring", "slight pollution"],
                  low: ["improving", "acceptable levels", "clearing"],
                  advice: [
                    "unhealthy air",
                    "sensitive groups",
                    "limit outdoor activity",
                  ],
                  watchAndAct: [
                    "very unhealthy",
                    "health warning",
                    "stay indoors",
                  ],
                  emergency: [
                    "hazardous air",
                    "emergency conditions",
                    "immediate health risk",
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
          low: ["cleared", "normal traffic", "minimal delay"],
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
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "carCrash" },
              create: {
                id: "carCrash",
                name: "Car Crash",
                description: "Vehicle accidents and collisions",
                severityKeywords: {
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
                  low: ["fire out", "cleared", "minimal damage"],
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
                  low: ["cleared", "water receded", "normal conditions"],
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
              },
            },
            {
              where: { id: "trainDerailment" },
              create: {
                id: "trainDerailment",
                name: "Train Derailment",
                description: "Railway accidents and derailments",
                severityKeywords: {
                  unknown: [],
                  info: ["train stopped", "minor issue", "investigating"],
                  low: ["service resumed", "minor delay", "no damage"],
                  advice: [
                    "derailment",
                    "service suspended",
                    "buses replacing",
                  ],
                  watchAndAct: [
                    "major derailment",
                    "injuries",
                    "hazmat involved",
                  ],
                  emergency: [
                    "catastrophic derailment",
                    "multiple casualties",
                    "toxic spill",
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
                  low: ["reopened", "one lane", "minimal impact"],
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
              },
            },
            {
              where: { id: "airportEmergency" },
              create: {
                id: "airportEmergency",
                name: "Airport Emergency",
                description: "Aviation emergencies and incidents",
                severityKeywords: {
                  unknown: [],
                  info: ["minor delay", "weather delay", "maintenance"],
                  low: ["normal operations", "minor disruption", "catching up"],
                  advice: ["significant delays", "diversions", "avoid airport"],
                  watchAndAct: [
                    "emergency landing",
                    "runway closed",
                    "major incident",
                  ],
                  emergency: [
                    "aircraft crash",
                    "airport closed",
                    "mass casualties",
                  ],
                },
              },
            },
            {
              where: { id: "ferryAccident" },
              create: {
                id: "ferryAccident",
                name: "Ferry Accident",
                description: "Marine transport accidents",
                severityKeywords: {
                  unknown: [],
                  info: ["minor incident", "service delay", "mechanical issue"],
                  low: ["service resumed", "backup ferry", "minor delay"],
                  advice: [
                    "ferry grounded",
                    "passengers evacuated",
                    "service suspended",
                  ],
                  watchAndAct: ["collision", "taking on water", "mayday call"],
                  emergency: [
                    "sinking",
                    "multiple casualties",
                    "search and rescue",
                  ],
                },
              },
            },
            {
              where: { id: "majorTrafficDelay" },
              create: {
                id: "majorTrafficDelay",
                name: "Major Traffic Delay",
                description: "Significant traffic congestion and delays",
                severityKeywords: {
                  unknown: [],
                  info: ["heavy traffic", "slow moving", "peak hour"],
                  low: ["traffic easing", "normal flow", "clearing"],
                  advice: ["severe congestion", "long delays", "avoid area"],
                  watchAndAct: ["gridlock", "hours delay", "major incident"],
                  emergency: [
                    "total gridlock",
                    "emergency vehicles blocked",
                    "evacuation hampered",
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
          low: ["service restored", "minimal impact", "backup systems"],
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
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "structuralFire" },
              create: {
                id: "structuralFire",
                name: "Structural Fire",
                description: "Fires in buildings and structures",
                severityKeywords: {
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
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
                severityKeywords: {
                  unknown: [],
                  info: ["power fluctuation", "brief outage", "investigating"],
                  low: ["power restored", "localized", "minimal impact"],
                  advice: [
                    "widespread outage",
                    "extended duration",
                    "seek shelter",
                  ],
                  watchAndAct: [
                    "major blackout",
                    "critical services affected",
                    "emergency shelters",
                  ],
                  emergency: [
                    "total grid failure",
                    "life support affected",
                    "catastrophic outage",
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
                  unknown: [],
                  info: ["gas odor", "investigating", "minor leak"],
                  low: ["leak repaired", "ventilated", "no danger"],
                  advice: [
                    "gas leak confirmed",
                    "evacuate area",
                    "no ignition sources",
                  ],
                  watchAndAct: [
                    "major gas leak",
                    "explosion risk",
                    "immediate evacuation",
                  ],
                  emergency: [
                    "gas explosion",
                    "multiple casualties",
                    "widespread danger",
                  ],
                },
              },
            },
            {
              where: { id: "internetDown" },
              create: {
                id: "internetDown",
                name: "Internet Down",
                description: "Internet and telecommunications outages",
                severityKeywords: {
                  unknown: [],
                  info: ["slow connection", "intermittent", "minor issues"],
                  low: [
                    "service restored",
                    "local issue",
                    "alternative available",
                  ],
                  advice: [
                    "widespread outage",
                    "services affected",
                    "seek alternatives",
                  ],
                  watchAndAct: [
                    "major outage",
                    "emergency services impacted",
                    "critical systems down",
                  ],
                  emergency: [
                    "total communications failure",
                    "emergency systems affected",
                    "national outage",
                  ],
                },
              },
            },
            {
              where: { id: "waterContamination" },
              create: {
                id: "waterContamination",
                name: "Water Contamination",
                description: "Water supply contamination issues",
                severityKeywords: {
                  unknown: [],
                  info: ["water testing", "precautionary", "monitoring"],
                  low: ["safe levels", "cleared", "normal supply"],
                  advice: [
                    "boil water",
                    "contamination detected",
                    "avoid consumption",
                  ],
                  watchAndAct: [
                    "dangerous levels",
                    "do not use",
                    "health risk",
                  ],
                  emergency: [
                    "toxic contamination",
                    "immediate health threat",
                    "mass poisoning",
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
                  unknown: [],
                  info: ["alarm activated", "small fire", "investigating"],
                  low: ["contained", "no spread", "normal operations"],
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
          info: [
            "crowd gathering",
            "community event",
            "festival scheduled",
            "large crowd expected",
            "general event notification",
            "routine crowd management plan",
            "no incident reported",
            "traffic/pedestrian management in place",
            "normal operations",
            "security present",
          ],
          advice: [
            "busy crowd",
            "high attendance",
            "queues forming",
            "crowd density increasing",
            "congestion at entry / exit",
            "police / security monitoring",
          ],
        },
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestivalIncident" },
              create: {
                id: "concertFestivalIncident",
                name: "Concert/Festival Incident",
                description: "Incidents at concerts and festivals",
                severityKeywords: {
                  info: [
                    "crowd gathering",
                    "community event",
                    "festival scheduled",
                    "large crowd expected",
                    "general event notification",
                    "routine crowd management plan",
                    "no incident reported",
                    "traffic/pedestrian management in place",
                    "normal operations",
                    "security present",
                  ],
                  advice: [
                    "busy crowd",
                    "high attendance",
                    "queues forming",
                    "crowd density increasing",
                    "congestion at entry / exit",
                    "police / security monitoring",
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
                    "crowd gathering",
                    "community event",
                    "festival scheduled",
                    "large crowd expected",
                    "general event notification",
                    "routine crowd management plan",
                    "no incident reported",
                    "traffic/pedestrian management in place",
                    "normal operations",
                    "security present",
                  ],
                  advice: [
                    "busy crowd",
                    "high attendance",
                    "queues forming",
                    "crowd density increasing",
                    "congestion at entry / exit",
                    "police / security monitoring",
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
                    "crowd gathering",
                    "community event",
                    "festival scheduled",
                    "large crowd expected",
                    "general event notification",
                    "routine crowd management plan",
                    "no incident reported",
                    "traffic/pedestrian management in place",
                    "normal operations",
                    "security present",
                  ],
                  advice: [
                    "busy crowd",
                    "high attendance",
                    "queues forming",
                    "crowd density increasing",
                    "congestion at entry / exit",
                    "police / security monitoring",
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
          unknown: [],
          info: ["miscellaneous incident", "unclassified", "investigating"],
          low: ["minor incident", "resolved", "no significant impact"],
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
    severities: hazardSeverities,
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
