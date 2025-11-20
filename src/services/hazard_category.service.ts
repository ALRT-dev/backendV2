import { buildHazardsWhereClause } from "../utils/hazard.util.js";
import prisma from "../utils/prisma_client.util.js";
import type {
  HazardCategory,
  HazardReviewStatus,
  LocationSubscription,
  Prisma,
} from "@prisma/client";
import type { HazardSeverityWithAwsCompliant } from "../models/hazard_search_params_interface.js";

/**
 * Main hazard category identifiers
 */
export enum MainCategoryId {
  securityAndCrime = "securityAndCrime",
  healthAndAir = "healthAndAir",
  weatherAndEnvironment = "weatherAndEnvironment",
  trafficAndTransport = "trafficAndTransport",
  utilitiesAndInfrastructure = "utilitiesAndInfrastructure",
  communityInfo = "communityInfo",
  other = "other",
}

/**
 * Check if any hazard categories exist in the database
 */
export const hasExistingCategories = async (): Promise<boolean> => {
  try {
    const count = await prisma.hazardCategory.count();
    return count > 0;
  } catch (error) {
    console.error("Error checking existing categories:", error);
    return false;
  }
};

/**
 * Initialize hazard categories if none exist
 * This function should be called when the server starts
 */
export const initializeHazardCategories = async (): Promise<void> => {
  try {
    const categoriesExist = await hasExistingCategories();

    if (!categoriesExist) {
      await populateInitialCategories();
      console.log(
        "---------------------------------------> Hazard categories initialized successfully"
      );
    }
  } catch (error) {
    console.error("❌ Error initializing hazard categories:", error);
    throw error;
  }
};

/**
 * Populate the database with a predefined set of hazard categories.
 * If a category already exists, it will not be duplicated.
 */
export const populateInitialCategories = async () => {
  try {
    const categories: Prisma.HazardCategoryCreateInput[] = [
      {
        id: MainCategoryId.securityAndCrime,
        name: "Security & Crime",
        description: "Crime, Civil Unrest, Terror Threat",
        keywords: [],
        color: "#FC9493",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "rescueRoad" },
              create: {
                id: "rescueRoad",
                name: "Rescue (Road)",
                description:
                  "Rescue operations for trapped individuals on roads",
                keywords: [
                  "road rescue",
                  "vehicle rescue",
                  "car rescue",
                  "truck rescue",
                ],
              },
            },
            {
              where: { id: "rescueMarine" },
              create: {
                id: "rescueMarine",
                name: "Rescue (Marine)",
                description:
                  "Rescue operations for trapped individuals in water",
                keywords: [
                  "marine rescue",
                  "water rescue",
                  "boat rescue",
                  "ship rescue",
                ],
              },
            },
            {
              where: { id: "crime" },
              create: {
                id: "crime",
                name: "Crime",
                description: "Criminal activities including theft and assault",
                keywords: [
                  "crime",
                  "theft",
                  "burglary",
                  "assault",
                  "robbery",
                  "vandalism",
                  "break and enter",
                  "carjacking",
                  "armed robbery",
                  "domestic violence",
                  "sexual assault",
                ],
              },
            },
            {
              where: { id: "terror" },
              create: {
                id: "terror",
                name: "Terror",
                description: "Terror threats and incidents",
                keywords: [
                  "terror",
                  "terrorism",
                  "police operations",
                  "security operations",
                  "escape hide tell",
                  "national security",
                  "suspicious persons",
                  "knife fight",
                  "investigation",
                  "active threat",
                ],
              },
            },
            {
              where: { id: "hazardousItem" },
              create: {
                id: "hazardousItem",
                name: "Hazardous Item",
                description: "Reports of hazardous items",
                keywords: [
                  "hazardous item",
                  "dangerous item",
                  "suspicious package",
                  "explosive device",
                  "bomb squad response",
                ],
              },
            },
            {
              where: { id: "missingPerson" },
              create: {
                id: "missingPerson",
                name: "Missing Person",
                description: "Reports of missing individuals",
                keywords: ["missing person", "lost person"],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.healthAndAir,
        name: "Health & Air",
        description: "Health-related emergencies and air quality issues",
        keywords: [
          "medical emergency",
          "health emergency",
          "ambulance needed",
          "paramedic response",
        ],
        color: "#FCC27B",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "ambulanceResponse" },
              create: {
                id: "ambulanceResponse",
                name: "Ambulance Response",
                description: "Emergency medical services dispatched",
                keywords: ["ambulance response"],
              },
            },
            {
              where: { id: "airQualityAlert" },
              create: {
                id: "airQualityAlert",
                name: "Air Quality Alert",
                description: "Air pollution and quality concerns",
                keywords: [
                  "poor air quality",
                  "airquality",
                  "air quality",
                  "air quality alert",
                  "air quality health alert",
                  "air pollution",
                  "smog",
                  "haze",
                  "air quality health alert",
                  "hazardous smoke",
                  "high pollution day",
                ],
              },
            },
            {
              where: { id: "smoke" },
              create: {
                id: "smoke",
                name: "Smoke",
                description: "Smoke from fires affecting air quality",
                keywords: ["smoke", "smoke health warning", "smoke haze"],
              },
            },
            {
              where: { id: "asthmaAlert" },
              create: {
                id: "asthmaAlert",
                name: "Asthma Alert",
                description: "Asthma-related health alerts",
                keywords: ["asthma", "asthma alert", "thunderstorm asthma"],
              },
            },
            {
              where: { id: "publicHealthAlert" },
              create: {
                id: "publicHealthAlert",
                name: "Public Health Alert",
                description: "Alerts related to public health concerns",
                keywords: ["public health alert", "health alert"],
              },
            },
            {
              where: { id: "diseaseOutbreak" },
              create: {
                id: "diseaseOutbreak",
                name: "Disease Outbreak",
                description: "Outbreaks of contagious diseases",
                keywords: [
                  "diseaseoutbreak",
                  "disease outbreak",
                  "contagious disease",
                ],
              },
            },
            {
              where: { id: "outbreak" },
              create: {
                id: "outbreak",
                name: "Outbreak",
                description: "General disease outbreaks",
                keywords: ["outbreak"],
              },
            },
            {
              where: { id: "infection" },
              create: {
                id: "infection",
                name: "Infection",
                description: "Infectious disease incidents",
                keywords: ["infection"],
              },
            },
            {
              where: { id: "virus" },
              create: {
                id: "virus",
                name: "Virus",
                description: "Viral infection incidents",
                keywords: ["virus", "viral infection"],
              },
            },
            {
              where: { id: "pandemic" },
              create: {
                id: "pandemic",
                name: "Pandemic",
                description: "Widespread infectious disease outbreaks",
                keywords: ["pandemic"],
              },
            },
            {
              where: { id: "heatHealthAlert" },
              create: {
                id: "heatHealthAlert",
                name: "Heat Health Alert",
                description: "Health alerts related to extreme heat",
                keywords: ["heat health alert"],
              },
            },
            {
              where: { id: "heatStress" },
              create: {
                id: "heatStress",
                name: "Heat Stress",
                description: "Incidents of heat stress",
                keywords: ["heat stress"],
              },
            },
            {
              where: { id: "uvAlert" },
              create: {
                id: "uvAlert",
                name: "UV Alert",
                description: "Alerts related to ultraviolet radiation",
                keywords: [
                  "uv index",
                  "ultraviolet index",
                  "uv warning",
                  "uv alert",
                ],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.weatherAndEnvironment,
        name: "Weather & Environment",
        description: "Weather and environmental hazards",
        keywords: ["marine wind"],
        color: "#97D7FA",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "bushfire" },
              create: {
                id: "bushfire",
                name: "Bushfire",
                description: "Wildfire and bushfire incidents",
                isFireRelated: true,
                keywords: [
                  "bush fire",
                  "bushfire",
                  "wild fire",
                  "wildfire",
                  "grass",
                  "grass fire",
                  "grassfire",
                  "forest fire",
                  "forestfire",
                  "vegetation fire",
                  "vegetationfire",
                  "scrub fire",
                  "scrubfire",
                ],
              },
            },
            {
              where: { id: "plannedBurn" },
              create: {
                id: "plannedBurn",
                name: "Planned Burn",
                description: "Controlled burns for land management",
                isFireRelated: true,
                keywords: [
                  "planned burn",
                  "hazard reduction",
                  "controlled burn",
                  "prescribed burn",
                  "burn off",
                  "planned event",
                ],
              },
            },
            {
              where: { id: "otherFire" },
              create: {
                id: "otherFire",
                name: "Other Fire",
                description: "Unclassified fire incidents",
                isFireRelated: true,
                keywords: ["fire alarm", "false alarm"],
              },
            },
            {
              where: { id: "cyclone" },
              create: {
                id: "cyclone",
                name: "Cyclone",
                description: "Severe weather hazards including cyclones",
                keywords: [
                  "cyclone",
                  "tropical cyclone watch",
                  "tropical cyclone warning",
                  "category 1–5 cyclone",
                ],
              },
            },
            {
              where: { id: "storm" },
              create: {
                id: "storm",
                name: "Storm",
                description: "Active storm events including thunderstorms",
                keywords: [
                  "storm",
                  "thunderstorm",
                  "severe weather warning",
                  "severe thunderstorm warning",
                ],
              },
            },
            {
              where: { id: "flood" },
              create: {
                id: "flood",
                name: "Flood",
                description: "Flooding and water-related emergencies",
                keywords: [
                  "flood",
                  "flood watch",
                  "minor flood",
                  "moderate flood",
                  "major flood",
                  "flash flooding",
                  "riverine flood",
                  "dam flood warning",
                ],
              },
            },
            {
              where: { id: "extremeHeat" },
              create: {
                id: "extremeHeat",
                name: "Extreme Heat",
                description: "Extreme heat events and heatwaves",
                keywords: [
                  "heatwave",
                  "heat wave",
                  "extreme heat",
                  "extreme heatwave",
                  "extreme heatwave warning",
                  "heat health alert",
                  "extreme heat warning",
                ],
              },
            },
            {
              where: { id: "damagingWinds" },
              create: {
                id: "damagingWinds",
                name: "Damaging Winds",
                description: "High wind events causing damage",
                keywords: ["damaging wind", "damaging winds", "damagingwind"],
              },
            },
            {
              where: { id: "strongWinds" },
              create: {
                id: "strongWinds",
                name: "Strong Winds",
                description: "High wind events causing damage",
                keywords: [],
              },
            },
            {
              where: { id: "snow" },
              create: {
                id: "snow",
                name: "Snow",
                description: "Snowfall and winter weather conditions",
                keywords: [],
              },
            },
            {
              where: { id: "tsunami" },
              create: {
                id: "tsunami",
                name: "Tsunami",
                description: "Tsunami events and warnings",
                keywords: [
                  "tsunami",
                  "tsunami watch",
                  "tsunami warning",
                  "marine warning",
                  "land inundation warning",
                ],
              },
            },
            {
              where: { id: "volcanicActivity" },
              create: {
                id: "volcanicActivity",
                name: "Volcanic Activity",
                description: "Volcanic eruptions and ash fall",
                keywords: ["volcanic activity"],
              },
            },
            {
              where: { id: "earthquake" },
              create: {
                id: "earthquake",
                name: "Earthquake",
                description: "Seismic events and tremors",
                keywords: [
                  "earthquake",
                  "earthquake alert",
                  "significant earthquake notice",
                ],
              },
            },
            {
              where: { id: "landslide" },
              create: {
                id: "landslide",
                name: "Landslide",
                description: "Movement of rock, earth, or debris down a slope",
                keywords: [
                  "landslide",
                  "slope instability",
                  "landslip",
                  "rockfall",
                  "slope failure",
                ],
              },
            },
            {
              where: { id: "coastalHazard" },
              create: {
                id: "coastalHazard",
                name: "Coastal Hazard",
                description: "Coastal hazards including erosion and inundation",
                keywords: ["coastalhazard", "coastal hazard"],
              },
            },
            {
              where: { id: "pollen" },
              create: {
                id: "pollen",
                name: "Pollen",
                description: "Pollen from plants affecting air quality",
                keywords: [
                  "pollen",
                  "high pollen count",
                  "allergy alert",
                  "hay fever",
                ],
              },
            },
            {
              where: { id: "fireWeather" },
              create: {
                id: "fireWeather",
                name: "Fire Weather",
                description: "Conditions conducive to fire outbreaks",
                keywords: ["fire weather", "fireweather"],
              },
            },
            {
              where: { id: "riverRise" },
              create: {
                id: "riverRise",
                name: "River Rise",
                description: "Rising river levels and potential flooding",
                keywords: ["river rise"],
              },
            },
            {
              where: { id: "heavyRain" },
              create: {
                id: "heavyRain",
                name: "Heavy Rain",
                description: "Incidents involving heavy rainfall",
                keywords: ["heavy rain"],
              },
            },
            {
              where: { id: "largeHail" },
              create: {
                id: "largeHail",
                name: "Large Hail",
                description: "Incidents involving large hail",
                keywords: ["large hail", "largehail"],
              },
            },
            {
              where: { id: "hailStorm" },
              create: {
                id: "hailStorm",
                name: "Hail Storm",
                description: "Incidents involving hail storms",
                keywords: ["hail storm", "hailstorm"],
              },
            },
            {
              where: { id: "landSlip" },
              create: {
                id: "landSlip",
                name: "Land Slip",
                description: "Incidents involving land slips",
                keywords: ["land slip"],
              },
            },
            {
              where: { id: "hazardousSurf" },
              create: {
                id: "hazardousSurf",
                name: "Hazardous Surf",
                description: "Hazardous surf conditions",
                keywords: ["hazardous surf", "rough surf"],
              },
            },
            {
              where: { id: "dustStorm" },
              create: {
                id: "dustStorm",
                name: "Dust Storm",
                description: "Dust storms and related hazards",
                keywords: ["dust storm", "duststorm"],
              },
            },
            {
              where: { id: "smokePlume" },
              create: {
                id: "smokePlume",
                name: "Smoke Plume",
                description: "Smoke plumes from fires affecting air quality",
                keywords: ["smoke plume", "smokeplume"],
              },
            },
            {
              where: { id: "ashfall" },
              create: {
                id: "ashfall",
                name: "Ashfall",
                description: "Ash fall from volcanic activity",
                keywords: ["ash fall", "ashfall"],
              },
            },
            {
              where: { id: "treeDown" },
              create: {
                id: "treeDown",
                name: "Tree Down",
                description: "Fallen trees causing hazards",
                keywords: [
                  "tree down",
                  "fallen tree",
                  "tree blocking road",
                  "tree blocking path",
                ],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.trafficAndTransport,
        name: "Traffic & Transport",
        description: "Traffic and transport disruptions",
        keywords: [],
        color: "#86DF9D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "crash" },
              create: {
                id: "crash",
                name: "Crash",
                description: "Vehicle accidents and collisions",
                keywords: [
                  "car crash",
                  "crash",
                  "vehicle accident",
                  "mva",
                  "serious crash",
                  "major traffic incident",
                  "multi-vehicle",
                  "multi-vehicle crash",
                ],
              },
            },
            {
              where: { id: "accident" },
              create: {
                id: "accident",
                name: "Accident",
                description: "General accidents and incidents",
                keywords: ["accident", "collision"],
              },
            },
            {
              where: { id: "vehicleFire" },
              create: {
                id: "vehicleFire",
                name: "Vehicle Fire",
                description: "Fires involving vehicles",
                isFireRelated: true,
                keywords: [
                  "vehicle fire",
                  "car fire",
                  "truck fire",
                  "bus fire",
                  "motorcycle fire",
                ],
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
                keywords: [
                  "public transport crowding",
                  "bus crowding",
                  "train crowding",
                  "subway crowding",
                ],
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
                keywords: [
                  "venue evacuation",
                  "mall evacuation",
                  "stadium evacuation",
                  "theatre evacuation",
                ],
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
                keywords: ["water over road"],
              },
            },
            {
              where: { id: "changedTrafficConditions" },
              create: {
                id: "changedTrafficConditions",
                name: "Changed Traffic Conditions",
                description:
                  "Altered traffic conditions due to various factors",
                keywords: ["changed traffic conditions"],
              },
            },
            {
              where: { id: "speedReduction" },
              create: {
                id: "speedReduction",
                name: "Speed Reduction",
                description: "Reduction in speed due to various factors",
                keywords: [
                  "speed reduction",
                  "speedreduction",
                  "reduced speed",
                  "reducedspeed",
                ],
              },
            },
            {
              where: { id: "roadWork" },
              create: {
                id: "roadWork",
                name: "Road Work",
                description: "Road construction and maintenance work",
                keywords: [
                  "roadwork",
                  "road work",
                  "road works",
                  "road closure",
                  "road upgrade",
                  "road closed",
                  "local access only",
                  "bridge closed",
                  "landslip on road",
                ],
              },
            },
            {
              where: { id: "roadDamage" },
              create: {
                id: "roadDamage",
                name: "Road Damage",
                description: "Damage to roads affecting travel",
                keywords: ["road damage", "pothole", "road hazard"],
              },
            },
            {
              where: { id: "maintenance" },
              create: {
                id: "maintenance",
                name: "Maintenance",
                description: "Vehicle maintenance issues affecting travel",
                keywords: ["maintenance"],
              },
            },
            {
              where: { id: "laneClosure" },
              create: {
                id: "laneClosure",
                name: "Lane Closure",
                description: "Closure of traffic lanes affecting travel",
                keywords: [
                  "laneclosure",
                  "lane closure",
                  "lanesclosed",
                  "lanes closed",
                ],
              },
            },
            {
              where: { id: "breakdown" },
              create: {
                id: "breakdown",
                name: "Breakdown",
                description: "Vehicle breakdowns affecting traffic",
                keywords: [
                  "breakdown",
                  "bus breakdown",
                  "car breakdown",
                  "truck breakdown",
                  "vehicle breakdown",
                ],
              },
            },
            {
              where: { id: "generalHazard" },
              create: {
                id: "generalHazard",
                name: "General Hazard",
                description: "General hazards affecting safety",
                keywords: ["generalhazard", "general hazard"],
              },
            },
            {
              where: { id: "obstruction" },
              create: {
                id: "obstruction",
                name: "Obstruction",
                description: "Obstructions affecting travel",
                keywords: ["obstruction", "road obstruction"],
              },
            },
            {
              where: { id: "debrisOnRoad" },
              create: {
                id: "debrisOnRoad",
                name: "Debris on Road",
                description: "Debris affecting travel on roads",
                keywords: ["debris on road", "road debris"],
              },
            },
            {
              where: { id: "spillOnRoad" },
              create: {
                id: "spillOnRoad",
                name: "Spill on Road",
                description: "Hazardous spills affecting travel on roads",
                keywords: ["spill on road", "road spill"],
              },
            },
            {
              where: { id: "trafficSignalFailure" },
              create: {
                id: "trafficSignalFailure",
                name: "Traffic Signal Failure",
                description: "Failures of traffic signals and lights",
                keywords: [
                  "traffic signal failure",
                  "traffic light failure",
                  "signal outage",
                ],
              },
            },
            {
              where: { id: "railDisruption" },
              create: {
                id: "railDisruption",
                name: "Rail Disruption",
                description: "Disruptions to rail services",
                keywords: ["rail disruption", "raildisruption"],
              },
            },
            {
              where: { id: "trainDisruption" },
              create: {
                id: "trainDisruption",
                name: "Train Disruption",
                description: "Disruptions to train services",
                keywords: ["train disruption", "traindisruption"],
              },
            },
            {
              where: { id: "tramDisruption" },
              create: {
                id: "tramDisruption",
                name: "Tram Disruption",
                description: "Disruptions to tram services",
                keywords: ["tram disruption", "tramdisruption"],
              },
            },
            {
              where: { id: "ferryDisruption" },
              create: {
                id: "ferryDisruption",
                name: "Ferry Disruption",
                description: "Disruptions to ferry services",
                keywords: ["ferry disruption", "ferrydisruption"],
              },
            },
            {
              where: { id: "railDelay" },
              create: {
                id: "railDelay",
                name: "Rail Delay",
                description: "Delays to rail services",
                keywords: ["rail delay", "raildelay"],
              },
            },
            {
              where: { id: "trainDelay" },
              create: {
                id: "trainDelay",
                name: "Train Delay",
                description: "Delays to train services",
                keywords: ["train delay", "traindelay"],
              },
            },
            {
              where: { id: "ferryDelay" },
              create: {
                id: "ferryDelay",
                name: "Ferry Delay",
                description: "Delays to ferry services",
                keywords: ["ferry delay", "ferrydelay"],
              },
            },
            {
              where: { id: "ferryCancellation" },
              create: {
                id: "ferryCancellation",
                name: "Ferry Cancellation",
                description: "Cancellations of ferry services",
                keywords: ["ferry cancellation", "ferrycancellation"],
              },
            },
            {
              where: { id: "busReplacement" },
              create: {
                id: "busReplacement",
                name: "Bus Replacement",
                description: "Bus replacement services for disrupted routes",
                keywords: ["bus replacement", "busreplacement"],
              },
            },
            {
              where: { id: "detour" },
              create: {
                id: "detour",
                name: "Detour",
                description: "Traffic detours and alternate routes",
                keywords: ["detour"],
              },
            },
            {
              where: { id: "trafficCongestion" },
              create: {
                id: "trafficCongestion",
                name: "Traffic Congestion",
                description: "Heavy traffic and congestion",
                keywords: ["traffic congestion", "trafficcongestion"],
              },
            },
            {
              where: { id: "flightDelay" },
              create: {
                id: "flightDelay",
                name: "Flight Delay",
                description: "Delays to flight services",
                keywords: ["flight delay", "flightdelay"],
              },
            },
            {
              where: { id: "airportClosure" },
              create: {
                id: "airportClosure",
                name: "Airport Closure",
                description: "Temporary or permanent closure of airports",
                keywords: ["airport closure", "airportclosure"],
              },
            },
            {
              where: { id: "taxiwayClosure" },
              create: {
                id: "taxiwayClosure",
                name: "Taxiway Closure",
                description: "Closure of airport taxiways",
                keywords: ["taxiway closure", "taxiwayclosure"],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.utilitiesAndInfrastructure,
        name: "Utilities & Infrastructure",
        description: "Infrastructure failures and service disruptions",
        keywords: [],
        color: "#FFE47A",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "structuralFire" },
              create: {
                id: "structuralFire",
                name: "Structural Fire",
                description: "Fires in buildings and structures",
                isFireRelated: true,
                keywords: [
                  "structure fire",
                  "haystack fire",
                  "structure",
                  "building fire",
                  "house fire",
                  "unit fire",
                  "factory fire",
                  "high-rise fire",
                  "bin fire",
                  "dump fire",
                ],
              },
            },
            {
              where: { id: "chemicalSpill" },
              create: {
                id: "chemicalSpill",
                name: "Chemical Spill",
                description: "Spills of hazardous chemicals",
                keywords: [
                  "chemical spill",
                  "hazardous chemical spill",
                  "toxic spill",
                  "chemical leak",
                ],
              },
            },
            {
              where: { id: "hazmatSpill" },
              create: {
                id: "hazmatSpill",
                name: "Hazmat Spill",
                description: "Hazardous material spills and leaks",
                keywords: [
                  "hazmat spill",
                  "hazardous material spill",
                  "hazmat leak",
                ],
              },
            },
            {
              where: { id: "powerOutage" },
              create: {
                id: "powerOutage",
                name: "Power Outage",
                description: "Electrical power failures and blackouts",
                keywords: [
                  "power outage",
                  "blackout",
                  "electricity outage",
                  "power failure",
                  "wire down",
                  "unplanned power outage",
                  "planned power outage",
                  "load shedding",
                ],
              },
            },
            {
              where: { id: "waterIssue" },
              create: {
                id: "waterIssue",
                name: "Water Issue",
                description: "Water supply issues",
                keywords: [
                  "burst water main",
                  "water outage",
                  "low pressure",
                  "burst main",
                ],
              },
            },
            {
              where: { id: "gasLeak" },
              create: {
                id: "gasLeak",
                name: "Gas Leak",
                description: "Natural gas leaks and related hazards",
                keywords: [
                  "gas leak",
                  "gas odor",
                  "gas smell",
                  "gas outage",
                  "gas supply interruption",
                ],
              },
            },
            {
              where: { id: "powerInterruption" },
              create: {
                id: "powerInterruption",
                name: "Power Interruption",
                description: "Interruptions to electrical power",
                keywords: ["power interruption", "powerinterruption"],
              },
            },
            {
              where: { id: "lossOfPower" },
              create: {
                id: "lossOfPower",
                name: "Loss of Power",
                description: "Loss of electrical power",
                keywords: ["loss of power", "lossofpower"],
              },
            },
            {
              where: { id: "brownout" },
              create: {
                id: "brownout",
                name: "Brownout",
                description: "Reduction in electrical power",
                keywords: ["brownout", "power brownout"],
              },
            },
            {
              where: { id: "waterSupplyInterruption" },
              create: {
                id: "waterSupplyInterruption",
                name: "Water Supply Interruption",
                description: "Interruptions to water supply",
                keywords: [
                  "water supply interruption",
                  "watersupplyinterruption",
                ],
              },
            },
            {
              where: { id: "boilWaterNotice" },
              create: {
                id: "boilWaterNotice",
                name: "Boil Water Notice",
                description: "Notice to boil water before use",
                keywords: ["boil water notice", "boilwaternotice"],
              },
            },
            {
              where: { id: "boilWaterAlert" },
              create: {
                id: "boilWaterAlert",
                name: "Boil Water Alert",
                description: "Alert to boil water before use",
                keywords: ["boil water alert", "boilwateralert"],
              },
            },
            {
              where: { id: "gasIncident" },
              create: {
                id: "gasIncident",
                name: "Gas Incident",
                description: "Incidents involving gas",
                keywords: ["gas incident", "gasincident"],
              },
            },
            {
              where: { id: "telecommunicationsOutage" },
              create: {
                id: "telecommunicationsOutage",
                name: "Telecommunications Outage",
                description: "Outage of telecommunications services",
                keywords: [
                  "telecommunications outage",
                  "telecommunicationsoutage",
                ],
              },
            },
            {
              where: { id: "phoneOutage" },
              create: {
                id: "phoneOutage",
                name: "Phone Outage",
                description: "Outage of phone services",
                keywords: ["phone outage", "phoneoutage"],
              },
            },
            {
              where: { id: "mobileOutage" },
              create: {
                id: "mobileOutage",
                name: "Mobile Outage",
                description: "Outage of mobile services",
                keywords: ["mobile outage", "mobileoutage"],
              },
            },
            {
              where: { id: "networkOutage" },
              create: {
                id: "networkOutage",
                name: "Network Outage",
                description: "Outage of network services",
                keywords: ["network outage", "networkoutage"],
              },
            },
            {
              where: { id: "serviceDisruption" },
              create: {
                id: "serviceDisruption",
                name: "Service Disruption",
                description: "Disruption to services",
                keywords: ["service disruption", "servicedisruption"],
              },
            },
            {
              where: { id: "damSafety" },
              create: {
                id: "damSafety",
                name: "Dam Safety",
                description: "Safety issues related to dams",
                keywords: ["dam safety", "damsafety"],
              },
            },
            {
              where: { id: "damSpill" },
              create: {
                id: "damSpill",
                name: "Dam Spill",
                description: "Spill events at dams",
                keywords: ["dam spill", "damspill"],
              },
            },
            {
              where: { id: "damOverflow" },
              create: {
                id: "damOverflow",
                name: "Dam Overflow",
                description: "Overflow events at dams",
                keywords: ["dam overflow", "damoverflow"],
              },
            },
            {
              where: { id: "damDischarge" },
              create: {
                id: "damDischarge",
                name: "Dam Discharge",
                description: "Discharge events at dams",
                keywords: ["dam discharge", "damdischarge"],
              },
            },
            {
              where: { id: "structuralDamage" },
              create: {
                id: "structuralDamage",
                name: "Structural Damage",
                description: "Damage to structures",
                keywords: ["structural damage", "structuraldamage"],
              },
            },
            {
              where: { id: "buildingDamage" },
              create: {
                id: "buildingDamage",
                name: "Building Damage",
                description: "Damage to buildings",
                keywords: ["building damage", "buildingdamage"],
              },
            },
            {
              where: { id: "infrastructureFailure" },
              create: {
                id: "infrastructureFailure",
                name: "Infrastructure Failure",
                description: "Failure of infrastructure",
                keywords: ["infrastructure failure", "infrastructurefailure"],
              },
            },
            {
              where: { id: "pipeBurst" },
              create: {
                id: "pipeBurst",
                name: "Pipe Burst",
                description: "Burst pipes",
                keywords: ["pipe burst", "pipeburst"],
              },
            },
            {
              where: { id: "sewerOverflow" },
              create: {
                id: "sewerOverflow",
                name: "Sewer Overflow",
                description: "Overflow of sewers",
                keywords: ["sewer overflow", "seweroverflow"],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.communityInfo,
        name: "Community/Info",
        description: "Community Events and Information Notices",
        keywords: [
          "special event",
          "crowd gathering",
          "community event",
          "festival scheduled",
          "large crowd expected",
          "general event notification",
          "sporting match",
          "protest",
          "rally",
          "demonstration",
        ],
        color: "#AB87F1",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "concertFestival" },
              create: {
                id: "concertFestival",
                name: "Concert/Festival",
                description: "Incidents at concerts and festivals",
                keywords: [
                  "concert",
                  "festival",
                  "music festival",
                  "live music event",
                ],
              },
            },
            {
              where: { id: "protest" },
              create: {
                id: "protest",
                name: "Protest",
                description: "Public demonstrations and protests",
                keywords: [
                  "protest",
                  "demonstration",
                  "rally",
                  "public gathering",
                  "mass gathering",
                ],
              },
            },
            {
              where: { id: "largeSportingEvent" },
              create: {
                id: "largeSportingEvent",
                name: "Large Sporting Event",
                description: "Incidents at sporting venues and events",
                keywords: [
                  "large sporting event",
                  "sporting event",
                  "sports match",
                  "football match",
                  "soccer match",
                ],
              },
            },
          ],
        },
      },
      {
        id: MainCategoryId.other,
        name: "Other",
        description: "Miscellaneous Hazards Not Classified Elsewhere",
        keywords: ["assist other agency"],
        color: "#BAA27D",
        subCategories: {
          connectOrCreate: [
            {
              where: { id: "algaeBloom" },
              create: {
                id: "algaeBloom",
                name: "Algae Bloom",
                description: "Harmful algal blooms in water bodies",
                keywords: [
                  "algae bloom",
                  "harmful algae bloom",
                  "red tide",
                  "blue-green algae",
                ],
              },
            },
            {
              where: { id: "electricalHazard" },
              create: {
                id: "electricalHazard",
                name: "Electrical Hazard",
                description: "Incidents involving electrical hazards",
                keywords: [
                  "electrical hazard",
                  "live wire",
                  "downed power line",
                  "electrocution risk",
                ],
              },
            },
            {
              where: { id: "sharkSighting" },
              create: {
                id: "sharkSighting",
                name: "Shark Sighting",
                description: "Reports of shark sightings in water bodies",
                keywords: [
                  "shark sighting",
                  "confirmed shark",
                  "beach closed due to shark",
                ],
              },
            },
            {
              where: { id: "evacuationCenter" },
              create: {
                id: "evacuationCenter",
                name: "Evacuation Center",
                description: "Designated evacuation centers during emergencies",
                keywords: [
                  "evacuation center",
                  "evacuate now",
                  "evacuation warning",
                  "evacuation centre open",
                ],
              },
            },
            {
              where: { id: "animalDisease" },
              create: {
                id: "animalDisease",
                name: "Animal Disease",
                description:
                  "Outbreaks of diseases affecting livestock or wildlife",
                keywords: [
                  "animal disease",
                  "livestock disease",
                  "wildlife disease",
                  "avian flu",
                  "foot and mouth disease",
                  "biosecurity alert",
                ],
              },
            },
            {
              where: { id: "pestInvasion" },
              create: {
                id: "pestInvasion",
                name: "Pest Invasion",
                description:
                  "Reports of pest invasions affecting health or property",
                keywords: [
                  "pest invasion",
                  "rodent infestation",
                  "insect swarm",
                  "vermin outbreak",
                  "locust plague",
                  "invasive pest alert",
                ],
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

    return createdCategories;
  } catch (error) {
    console.error("Error populating hazard categories:", error);
    throw error;
  }
};

/**
 * Force populate initial categories regardless of existing data
 * This function can be called manually if you want to reset or update categories
 */
export const forcePopulateCategories = async (): Promise<void> => {
  try {
    console.log("🔄 Force populating hazard categories...");
    await populateInitialCategories();
    console.log("✅ Categories force-populated successfully");
  } catch (error) {
    console.error("❌ Error force-populating categories:", error);
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
    include: {
      parent: true,
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
