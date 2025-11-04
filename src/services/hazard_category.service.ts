import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import {
  Prisma,
  type HazardCategory,
  type HazardReviewStatus,
  type HazardSeverity,
  type LocationSubscription,
} from "@prisma/client";

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
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
                severityKeywords: {
                  unknown: [],
                  info: ["reported", "investigation", "patrol increased"],
                  low: ["minor theft", "resolved", "suspect apprehended"],
                  advice: [
                    "theft reported",
                    "be vigilant",
                    "secure belongings",
                  ],
                  watchAndAct: ["assault", "robbery", "armed crime"],
                  emergency: [
                    "violent crime",
                    "active shooter",
                    "hostage situation",
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
              where: { id: "shooting" },
              create: {
                id: "shooting",
                name: "Shooting",
                description: "Gun violence incidents",
                severityKeywords: {
                  unknown: [],
                  info: ["gunshots heard", "investigating", "unconfirmed"],
                  low: ["false alarm", "fireworks", "construction noise"],
                  advice: ["shots fired", "police responding", "avoid area"],
                  watchAndAct: [
                    "active shooting",
                    "injuries",
                    "shelter in place",
                  ],
                  emergency: [
                    "mass shooting",
                    "multiple casualties",
                    "immediate evacuation",
                  ],
                },
              },
            },
            {
              where: { id: "terrorism" },
              create: {
                id: "terrorism",
                name: "Terrorism",
                description: "Terrorist activities and threats",
                severityKeywords: {
                  unknown: [],
                  info: [
                    "threat assessment",
                    "increased vigilance",
                    "unconfirmed threat",
                  ],
                  low: ["false alarm", "hoax", "cleared"],
                  advice: [
                    "credible threat",
                    "heightened security",
                    "avoid large gatherings",
                  ],
                  watchAndAct: [
                    "imminent threat",
                    "evacuation ordered",
                    "attack likely",
                  ],
                  emergency: ["active attack", "explosion", "immediate danger"],
                },
              },
            },
            {
              where: { id: "bombThreat" },
              create: {
                id: "bombThreat",
                name: "Bomb Threat",
                description: "Explosive device threats and incidents",
                severityKeywords: {
                  unknown: [],
                  info: ["threat received", "investigating", "precautionary"],
                  low: ["hoax", "false alarm", "all clear"],
                  advice: [
                    "credible threat",
                    "building evacuation",
                    "bomb squad",
                  ],
                  watchAndAct: [
                    "device found",
                    "area cordoned",
                    "immediate evacuation",
                  ],
                  emergency: ["explosion", "casualties", "multiple devices"],
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
                  info: ["ambulance dispatched", "routine call", "assessment"],
                  low: ["non-emergency", "transport only", "stable condition"],
                  advice: [
                    "urgent response",
                    "serious condition",
                    "multiple units",
                  ],
                  watchAndAct: [
                    "critical patient",
                    "trauma team",
                    "air ambulance",
                  ],
                  emergency: [
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
              where: { id: "heavyRain" },
              create: {
                id: "heavyRain",
                name: "Heavy Rain",
                description: "Intense rainfall and precipitation",
                severityKeywords: {
                  unknown: [],
                  info: ["rain developing", "showers", "light rain"],
                  low: ["moderate rain", "clearing", "drizzle"],
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
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                severityKeywords: {
                  unknown: [],
                  info: ["minor tremor", "felt slightly", "no damage"],
                  low: ["light shaking", "minimal damage", "aftershock"],
                  advice: [
                    "moderate earthquake",
                    "some damage",
                    "check for injuries",
                  ],
                  watchAndAct: [
                    "strong earthquake",
                    "significant damage",
                    "tsunami possible",
                  ],
                  emergency: [
                    "major earthquake",
                    "widespread destruction",
                    "catastrophic",
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
                  info: ["unstable ground", "monitoring", "minor movement"],
                  low: ["small slide", "contained", "road affected"],
                  advice: [
                    "landslide risk",
                    "avoid area",
                    "evacuate if advised",
                  ],
                  watchAndAct: [
                    "active landslide",
                    "major slide",
                    "immediate danger",
                  ],
                  emergency: [
                    "catastrophic landslide",
                    "buried structures",
                    "multiple casualties",
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
                  unknown: [],
                  info: ["minor accident", "fender bender", "no injuries"],
                  low: ["cleared", "towed away", "traffic flowing"],
                  advice: ["serious accident", "injuries", "lane closures"],
                  watchAndAct: [
                    "major crash",
                    "multiple vehicles",
                    "helicopter",
                  ],
                  emergency: [
                    "fatal accident",
                    "mass casualty",
                    "highway closure",
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
                  unknown: ["not applicable"],
                  info: ["smoke detected", "alarm activated", "investigating"],
                  low: ["small fire", "contained", "no spread"],
                  advice: ["building fire", "evacuating", "avoid area"],
                  watchAndAct: ["major fire", "spreading", "collapse risk"],
                  emergency: [
                    "catastrophic fire",
                    "building collapse",
                    "multiple casualties",
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
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
                severityKeywords: {
                  unknown: [],
                  info: ["minor spill", "contained", "cleaning up"],
                  low: ["spill cleaned", "no danger", "area safe"],
                  advice: ["hazmat spill", "avoid area", "decontamination"],
                  watchAndAct: [
                    "major spill",
                    "toxic exposure",
                    "evacuate immediately",
                  ],
                  emergency: [
                    "catastrophic spill",
                    "widespread contamination",
                    "mass casualties",
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
          info: ["event planned", "crowd gathering", "normal event"],
          low: ["orderly crowd", "event concluded", "dispersing"],
          advice: ["crowd control", "avoid area", "potential disruption"],
          watchAndAct: ["crowd incident", "dangerous situation", "evacuate"],
          emergency: ["crowd disaster", "stampede", "mass casualties"],
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
                  unknown: [],
                  info: [
                    "event ongoing",
                    "normal operations",
                    "security present",
                  ],
                  low: ["minor incident", "resolved", "event continues"],
                  advice: [
                    "incident reported",
                    "medical attention",
                    "area cordoned",
                  ],
                  watchAndAct: [
                    "major incident",
                    "event stopped",
                    "evacuation",
                  ],
                  emergency: [
                    "catastrophic incident",
                    "multiple casualties",
                    "venue collapse",
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
                  unknown: [],
                  info: ["peaceful protest", "demonstration", "permitted"],
                  low: ["dispersing", "peaceful", "no incidents"],
                  advice: ["tensions rising", "avoid area", "road closures"],
                  watchAndAct: ["violent protest", "clashes", "arrests"],
                  emergency: [
                    "riot",
                    "widespread violence",
                    "property destruction",
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
                  unknown: [],
                  info: ["event day", "crowds expected", "security measures"],
                  low: ["normal crowd", "orderly", "no issues"],
                  advice: ["crowd issues", "delays", "avoid area"],
                  watchAndAct: ["crowd trouble", "violence", "evacuation"],
                  emergency: [
                    "stadium disaster",
                    "structural failure",
                    "mass casualties",
                  ],
                },
              },
            },
            {
              where: { id: "crowdCrushStampede" },
              create: {
                id: "crowdCrushStampede",
                name: "Crowd Crush/Stampede",
                description: "Dangerous crowd movements and stampedes",
                severityKeywords: {
                  unknown: [],
                  info: ["crowd density", "monitoring", "crowd control"],
                  low: ["managed", "dispersing", "safety measures"],
                  advice: ["dangerous density", "avoid area", "crowd pressure"],
                  watchAndAct: [
                    "crowd crush",
                    "people trapped",
                    "emergency response",
                  ],
                  emergency: [
                    "stampede",
                    "multiple casualties",
                    "catastrophic crowd failure",
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
  hazardSeverities?: HazardSeverity[] | undefined;
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
