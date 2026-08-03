# Hazards Ingestion and Normalization Pipeline

## Overview

This document provides a comprehensive guide to how the ALRT platform automatically collects and normalizes hazard information from official Australian emergency services and environmental agencies. This automated system ensures that hazard data is standardized, accurate, and ready for use across the platform.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Sources](#data-sources)
3. [Pipeline Stages](#pipeline-stages)
4. [Data Flow](#data-flow)
5. [Summary](#summary)
6. [Appendix: Common Scenarios](#appendix-common-scenarios)

---

## System Overview

The hazards ingestion pipeline is an automated system that continuously monitors official government and environmental data sources for hazard information. The system operates in real-time, processing thousands of hazard alerts daily across multiple categories:

- **Emergency Incidents**: Bushfires, floods, storms, and other emergency events
- **Environmental Conditions**: Air quality, UV levels, pollen counts
- **Transport Disruptions**: Road hazards, traffic incidents, major events
- **Travel Advisories**: International travel safety information

The pipeline ensures that all hazard information is:

- **Accurate**: Sourced only from official, trusted agencies
- **Current**: Updated every 15 minutes as situations develop
- **Relevant**: Filtered by location and severity
- **Consistent**: Normalized to unified data structure

---

## Data Sources

### Australian Emergency Services

The system monitors **11 official data sources** across all Australian states and territories:

#### Fire and Emergency Services

- **NSW Rural Fire Service (RFS)**: Bushfire incidents and fire danger ratings
- **ACT Emergency Services**: Emergency incidents in the ACT region
- **Country Fire Service (CFS) SA**: South Australian fire incidents
- **Victoria Emergency Services**: Emergency incidents in Victoria
- **Queensland Fire Department**: Bushfire alerts and incidents
- **NT Fire and Rescue**: Northern Territory emergency incidents
- **DFES Western Australia**: WA emergency warnings and incidents

#### Environmental Monitoring

- **Bureau of Meteorology (BoM)** — _currently disabled (parser commented out in `ingestion.service.ts`)_: Weather warnings and forecasts for all Australian states
  - Severe weather warnings (storms, cyclones, flooding)
  - Fire weather warnings
  - Coastal hazards
  - Heatwave alerts
- **World Air Quality Index (WAQI)**: Real-time air quality monitoring across Australia
  - Focuses on moderate to critical air quality levels
  - Filters out low-severity readings to reduce noise
- **Open-Meteo**: Environmental health data
  - UV radiation levels
  - Pollen forecasts (birch, grass, olive, ragweed)
  - Filtered to show only elevated risk conditions

#### Transport and Travel

- **NSW Transport**: Road incidents, traffic hazards, and major events affecting NSW transport networks

- **Smartraveller** — _currently disabled (source commented out in `ingestion.service.ts`)_: Official travel advisories for international destinations
  - Security alerts
  - Safety warnings
  - Travel restrictions
  - Health advisories

### Data Source Reliability

All data sources are:

- **Official**: Government-run or officially sanctioned agencies
- **Verified**: Sources with established reputations for accuracy
- **Real-time**: Updated continuously by the source agencies
- **Comprehensive**: Covering all major hazard types and geographic areas

---

## Pipeline Stages

The ingestion pipeline consists of two main stages that transform raw data from external sources into a consistent, normalized format:

### Stage 1: Data Collection

**What Happens:**
The system automatically fetches data from all configured sources simultaneously. Each source provides data in different formats (JSON, XML/RSS, GeoJSON), which requires specialized handling.

**Key Features:**

- **Parallel Processing**: All sources are queried at the same time to minimize delays
- **Format Handling**: Automatic detection and parsing of different data formats
- **Multiple Endpoints**: Some sources have multiple API endpoints that are all monitored
- **Error Resilience**: If one source fails, others continue processing normally

**Example:**
When the system runs, it simultaneously:

- Fetches the latest bushfire data from NSW RFS
- Retrieves weather warnings from BoM for all states
- Gets air quality readings from WAQI
- Pulls transport incidents from NSW Transport
- And all other configured sources...

### Stage 2: Data Normalization

**What Happens:**
Each source provides data in a unique format with different field names, structures, and conventions. The normalization stage converts all this disparate data into a single, consistent format that the system can process uniformly. This involves format-specific parsing, field mapping, coordinate extraction, category classification, and severity determination.

#### Format-Specific Parsing

Different sources use different data formats that require specialized parsing:

**GeoJSON Format (NSW RFS, NSW Transport, ACT ES, CFS)**

- **Input Structure**: FeatureCollection with array of Feature objects
- **Parsing Process**:
  1. Extract features array from root object
  2. For each feature, extract geometry and properties
  3. Map properties to standardized fields:
     - `properties.title` or `properties.displayName` → `title`
     - `properties.description` or `properties.otherAdvice` → `description`
     - `properties.guid` → Extract numeric ID for unique identifier
     - `properties.pubDate` → Parse to `occurredAt` timestamp
     - `properties.end` → Parse to `expiresAt` timestamp
  4. Extract coordinates from geometry object
  5. Handle nested categories (`mainCategory`, `subCategoryA`)

**Example Transformation (NSW RFS):**

```
Input GeoJSON:
{
  "type": "Feature",
  "id": "12345",
  "geometry": {
    "type": "Point",
    "coordinates": [151.2093, -33.8688]
  },
  "properties": {
    "title": "ADVICE: Bushfire at SMITH ROAD, OAKVILLE",
    "description": "Fire crews attending...",
    "pubDate": "17/12/2025",
    "status": "Advice"
  }
}

Output Normalized:
{
  "id": "rfs-12345",
  "title": "ADVICE: Bushfire at SMITH ROAD, OAKVILLE",
  "description": "Fire crews attending...",
  "latitude": -33.8688,
  "longitude": 151.2093,
  "occurredAt": 2025-12-17T00:00:00Z,
  "category": "Fire",
  "severity": "advice",
  "severityBand": "monitor"
}
```

**RSS/XML Format (Victoria ES, QLD Fire, ACT ES, BoM, WA DFES)**

- **Input Structure**: XML with `<rss><channel><item>` structure
- **Parsing Process**:
  1. Parse XML using RSS parser library
  2. Extract custom fields: `identifier`, `georss:point`, `category`
  3. Map RSS fields to standardized fields:
     - `item.title` → Clean and extract `title`
     - `item.content` or `item.description` → `description`
     - `item.guid` or `item.identifier` → Extract ID
     - `item.pubDate` → Parse to `occurredAt`
     - `georss:point` → Parse to `latitude, longitude`
     - `category.$term` → Extract alert level
  4. Clean HTML tags from descriptions
  5. Handle special formatting (line breaks, whitespace)

**Example Transformation (Victoria ES):**

```
Input RSS:
<item>
  <title>Grass Fire - Near Bendigo</title>
  <description><![CDATA[<p>Fire crews attending grassfire...</p>]]></description>
  <guid>vic-incident-67890</guid>
  <pubDate>Tue, 17 Dec 2025 10:23:00 +1100</pubDate>
  <georss:point>-36.7570 144.2794</georss:point>
  <category term="Watch and Act"/>
</item>

Output Normalized:
{
  "id": "viceFire-67890",
  "title": "Grass Fire - Near Bendigo",
  "description": "Fire crews attending grassfire...",
  "latitude": -36.7570,
  "longitude": 144.2794,
  "occurredAt": 2025-12-17T10:23:00Z,
  "category": "Fire",
  "severity": "watchAndAct",
  "severityBand": "action"
}
```

**JSON Format (CFS, NT Fire and Rescue, WAQI)**

- **Input Structure**: Custom JSON schemas specific to each agency
- **Parsing Process**:
  1. Parse JSON response
  2. Navigate agency-specific structure:
     - **CFS**: Array of incident objects with `IncidentNo`, `Date`, `Time`, `Location`, `Type`
     - **NT Fire**: Nested structure with `incidents.features` array
     - **WAQI**: Data array with AQI measurements and station info
  3. Map agency-specific fields to standard schema
  4. Parse coordinate formats:
     - CFS: String format "lat,lng" → Split and convert
     - NT Fire: GeoJSON geometry object → Extract point
     - WAQI: Direct `lat`, `lon` fields
  5. Combine date/time fields where separated

**Example Transformation (CFS):**

```
Input CFS JSON:
{
  "IncidentNo": "13245678",
  "Date": "17/12/2025",
  "Time": "14:23",
  "Type": "Grass Fire",
  "Location_name": "SMITH ROAD, OAKVILLE",
  "Location": "-34.5000,138.7000",
  "Status": "Active"
}

Output Normalized:
{
  "id": "cfs-13245678",
  "title": "Grass Fire - SMITH ROAD, OAKVILLE",
  "description": "Type: Grass Fire\nLocation: SMITH ROAD, OAKVILLE\nStatus: Active",
  "latitude": -34.5000,
  "longitude": 138.7000,
  "occurredAt": 2025-12-17T14:23:00Z,
  "category": "Fire",
  "severity": "advice",
  "severityBand": "monitor"
}
```

**Bureau of Meteorology (BoM) Special Handling:**

- **Challenge**: BoM RSS feeds contain warnings without coordinates
- **Solution**: Location extraction from text description
- **Process**:
  1. Parse RSS feed per state (8 different endpoints)
  2. Extract warning title (contains location names)
  3. Use AI to extract mentioned locations from title
  4. Geocode extracted locations to get coordinates
  5. Create one hazard per mentioned location

**Example Transformation (BoM):**

```
Input BoM RSS:
<title>Severe Weather Warning for DAMAGING WINDS for Sydney,
Wollongong, Nowra and surrounding areas</title>

Processing Steps:
1. AI Extraction: ["Sydney", "Wollongong", "Nowra"]
2. Geocoding:
   - Sydney → -33.8688, 151.2093
   - Wollongong → -34.4244, 150.8931
   - Nowra → -34.8847, 150.5997
3. Create 3 hazards (one per location)

Output Normalized (Sydney):
{
  "id": "bom-nsw-severe-weather-12345-sydney",
  "title": "Severe Weather Warning - Damaging Winds",
  "description": "Severe Weather Warning for DAMAGING WINDS...",
  "latitude": -33.8688,
  "longitude": 151.2093,
  "locationName": "Sydney",
  "category": "Weather & Environment",
  "severity": "watchAndAct",
  "severityBand": "action"
}
```

#### Location Processing

**1. Coordinate Extraction Algorithms**

The system uses multiple strategies based on data format:

**Strategy A: Direct Coordinate Fields**

- **Used for**: WAQI, some GeoJSON sources
- **Fields**: `lat`, `lon`, `latitude`, `longitude`
- **Validation**:
  - Reject if coordinates are null or missing
  - Note: No geographic boundary validation is performed (coordinates are trusted from official sources)

**Strategy B: GeoJSON Geometry Parsing**

- **Used for**: NSW RFS, NT Fire and Rescue
- **Process**:
  1. Check geometry type (Point, Polygon, MultiPolygon)
  2. For Point: Extract coordinates array `[longitude, latitude]` (note order!)
  3. For Polygon: Calculate centroid of boundary points
  4. For MultiPolygon: Use first polygon's centroid
  5. Convert to decimal degrees if needed

**Strategy C: String Parsing**

- **Used for**: CFS, some legacy sources
- **Formats handled**:
  - Comma-separated: `"latitude,longitude"` or `"longitude,latitude"`
  - Space-separated: `"latitude longitude"`
  - GeoRSS format: `<georss:point>lat lon</georss:point>`
- **Algorithm**:
  1. Split string by delimiter (comma or space)
  2. Parse to float values
  3. Determine order by magnitude (Australia: lat < 0, lon > 0)
  4. Swap if detected in wrong order

**Strategy D: Address Geocoding**

- **Used for**: BoM (weather warnings without coordinates)
- **Process**:
  1. Extract location names from warning title using AI
  2. For each extracted location:
     - Check geocoding cache (SHA-256 hash of location name as key)
     - If not cached:
       - Call Google Geocoding API with location name
       - Store result in cache with 7-day TTL
     - Return cached coordinates
  3. Create separate hazard for each geocoded location
- **Cache Performance**: ~85% hit rate (most locations recur)

**Strategy E: Location Name Only (No Coordinates)**

- **Used for**: Smartraveller (international travel advisories)
- **Process**:
  1. Extract country name from advisory data
  2. Store as `locationName` field only
  3. No coordinates assigned (international locations)
  4. Geocoding performed later

**2. Reverse Geocoding (Coordinates → Address)**

- **Purpose**: Convert lat/lng to human-readable address
- **API**: Google Reverse Geocoding API
- **Process**:
  1. Check cache first (coordinates rounded to 4 decimals)
  2. If not cached:
     - Call API with coordinate pair
     - Parse response for address components:
       - Street address (route + street_number)
       - Suburb (locality)
       - City (administrative_area_level_2)
       - State (administrative_area_level_1)
       - Postcode (postal_code)
  3. Build formatted address: "123 Smith Road, Oakville, SA 5558"
  4. Cache result for 30 days
  5. Store as `locationName` field

**3. Location Name Extraction from Descriptions**

- **Purpose**: Find specific locations mentioned in text
- **Method**: AI-powered extraction using OPEN AI
- **Process**:
  1. Generate cache key from description text (SHA-256 hash)
  2. Check cache (24-hour TTL)
  3. If not cached:
     - Send to AI with specialized prompt: "Extract all location names (roads, suburbs, landmarks) from this text"
     - Receive structured response: `{ locations: ["Pacific Highway", "Coffs Harbour"] }`
     - Cache the result
  4. Return location array

**Example Location Processing:**

```
Input:
- Coordinates: [-34.5000, 138.7000]
- Description: "Fire near intersection of Smith Road and Main Street,
  affecting Oakville and surrounding areas"

Processing:
1. Coordinates validated ✓ (present and not null)
2. Reverse geocode: [-34.5000, 138.7000]
   → Check cache first (miss)
   → Call Google Reverse Geocoding API
   → Parse response: "Smith Road, Oakville SA 5558, Australia"
   → Extract formatted address
   → Store in cache with 30-day TTL
3. Set locationName from geocoding result

Output:
- latitude: -34.5000
- longitude: 138.7000
- locationName: "Smith Road, Oakville SA 5558, Australia"

Note: AI extraction from descriptions is only used for sources like BoM
that provide warnings without coordinates, not for hazards that already
have coordinate data.
```

#### Category Classification

The system uses a sophisticated two-tier category structure with **7 main (parent) categories** and **multiple subcategories** under each. The classification algorithm employs a priority-based matching system with fallback mechanisms.

**Category Taxonomy:**

**Main Categories (Parents):**

1. **Security & Crime** - Crime, civil unrest, terror threats, rescue operations
2. **Health & Air** - Medical emergencies, air quality, disease outbreaks
3. **Weather & Environment** - Fires, storms, floods, extreme weather, environmental alerts
4. **Traffic & Transport** - Crashes, road closures, traffic hazards, breakdowns
5. **Utilities & Infrastructure** - Structural fires, power outages, hazmat incidents, infrastructure failures
6. **Community Info** - Public events, festivals, protests, large gatherings
7. **Other** - Miscellaneous hazards not fitting other categories

**Classification Algorithm:**

The system performs a multi-pass keyword matching process with strict priority rules:

**Phase 1: Source-Provided Categories (Highest Priority)**

- **NSW Transport**: Uses `mainCategory` and `subCategoryA` fields directly
  - Example: `mainCategory: "Hazard"`, `subCategoryA: "Traffic Hazard"`
  - Mapped to our taxonomy first, then keyword matching applied if needed
- **NT Fire and Rescue**: `_category` field maps to subcategories
- **Smartraveller**: Always assigned to "Security & Crime" main category

**Phase 2: Direct Keyword Matching**

Direct matching requires **exact word or phrase boundaries**:

- Multi-word phrases: Exact phrase match with word boundaries (e.g., "bushfire" matches "a bushfire occurred" but not "bushfirewas")
- Single words: Exact word match (e.g., "storm" matches "severe storm" but not "brainstorm")

The algorithm searches in **three category groups simultaneously**:

**Group 1: AWS-Compliant Categories (Highest Match Priority)**

- These are special subcategories that follow Australian Warning System standards
- AWS categories: `bushfire`, `cyclone`, `storm`, `flood`, `extremeHeat`, `damagingWinds`, `earthquake`
- Example keywords:
  - **bushfire**: "bushfire", "bush fire", "wildfire", "grass fire", "forest fire", "vegetation fire", "scrub fire"
  - **cyclone**: "cyclone", "tropical cyclone watch", "tropical cyclone warning", "category 1-5 cyclone"
  - **storm**: "storm", "thunderstorm", "severe weather warning", "severe thunderstorm warning"
  - **flood**: "flood", "flood watch", "minor flood", "moderate flood", "major flood", "flash flooding"
  - **extremeHeat**: "heatwave", "extreme heat", "heat wave", "heat health alert"

**Group 2: Subcategories (Child Categories)**

- Specific hazard types under main categories
- Examples from each main category:

  **Security & Crime:**

  - `rescueRoad`: "road rescue", "vehicle rescue", "car rescue"
  - `rescueMarine`: "marine rescue", "water rescue", "boat rescue"

  **Health & Air:**

  - `airQualityAlert`: "air quality", "air pollution", "smog", "haze", "hazardous smoke"
  - `smoke`: "smoke", "smoke health warning", "smoke haze"
  - `diseaseOutbreak`: "disease outbreak", "epidemic", "pandemic"

  **Weather & Environment:**

  - `plannedBurn`: "planned burn", "hazard reduction", "controlled burn"
  - `damagingWinds`: "damaging winds", "destructive winds", "severe winds"
  - `uvAlert`: "uv alert", "uv warning", "extreme uv", "sun exposure warning"
  - `pollen`: "pollen", "high pollen", "grass pollen", "tree pollen"

  **Traffic & Transport:**

  - `crash`: "car crash", "crash", "vehicle accident", "multi-vehicle crash"
  - `roadClosure`: "road closure", "road closed", "lane closure"
  - `trafficHazard`: "traffic hazard", "debris on road", "object on road"
  - `breakdown`: "breakdown", "vehicle breakdown", "broken down vehicle"

  **Utilities & Infrastructure:**

  - `structuralFire`: "structure fire", "building fire", "house fire", "high-rise fire"
  - `powerOutage`: "power outage", "power failure", "electrical outage"
  - `hazmatSpill`: "hazmat", "hazmat spill", "hazardous material"
  - `gasLeak`: "gas leak", "natural gas leak", "lpg leak"

  **Community Info:**

  - `concertFestival`: "concert", "festival", "music festival"
  - `protest`: "protest", "demonstration", "rally", "public gathering"
  - `largeSportingEvent`: "sporting event", "football match", "sports match"

**Group 3: Main Categories (Parent Categories)**

- Broader category groups with general keywords
- Only matched if no subcategory matches

**Phase 3: Normal (Substring) Keyword Matching**

If no direct matches found, the algorithm performs substring matching:

- Checks if keyword appears anywhere in description (case-insensitive)
- Example: "storm" matches "brainstorming" (less strict)
- Same priority rules apply (AWS > Subcategories > Main Categories)

**Priority Resolution for Multiple Matches:**

When multiple categories match, the system applies these priority rules in order:

1. **AWS Category Wins** (If any AWS category matched)

   - AWS categories always take precedence
   - Example: Both "bushfire" and "fire" match → Bushfire (AWS) is selected

2. **Subcategory Using Lookup Priority** (If multiple subcategories matched)

   - Uses main category priority order: Security & Crime > Health & Air > Weather & Environment > Traffic & Transport > Utilities & Infrastructure > Community Info > Other
   - Selects first subcategory whose parent matches the priority order
   - Example: Matches both "air quality" (Health & Air) and "smoke" (Health & Air) → Uses first match

3. **Main Category Using Lookup Priority** (If multiple main categories matched)
   - Same priority order as above
   - Example: Matches both "Weather & Environment" and "Traffic & Transport" → Weather & Environment (higher priority)

**Phase 4: Fallback Mechanism**

If no matches found in any phase:

1. Check for fallback category parameter (can be specified per source)
2. Default to "Other" main category
3. Log for manual review

**Complete Classification Example:**

```
Input:
- Source: NSW RFS
- Description: "WATCH AND ACT: Bushfire burning in grass and scrubland
  near Smith Road. Fire crews on scene. Prepare to leave immediately."

Classification Process:

Phase 1: Source Category Check
- RFS doesn't provide explicit category fields
- Continue to keyword matching

Phase 2: Direct Keyword Matching
Step 1: Check AWS Categories
  - "bushfire" found (exact word match) ✓
  - "grass fire" found (exact phrase match) ✓
  - Result: AWS category "bushfire" matches

Step 2: Check Subcategories
  - Multiple fire-related subcategories may match
  - But AWS match already found (higher priority)

Step 3: Check Main Categories
  - "Weather & Environment" keywords may match
  - But AWS and subcategory matches already found

Priority Resolution:
- AWS category matched: "bushfire" ✓ (HIGHEST PRIORITY)
- Return immediately - no further checking needed

Phase 3: Normal Matching
- Skipped (direct match found)

Phase 4: Fallback
- Not needed (match found)

Output:
- category: "Weather & Environment > Bushfire" (AWS compliant subcategory)
- isAwsCompliant: true
- parent: "Weather & Environment"

Additional Classification:
- Fire Status Detection: Checks keywords for fire status
  - "on scene" found → FireStatus: "active"
  - Possible statuses: active, beingControlled, underControl, closed
```

**Edge Cases:**

1. **Multiple AWS Categories Match**: First AWS match wins
2. **Same Main Category, Different Subcategories**: First matched subcategory wins
3. **No Keywords Match**: Falls back to "Other" category
4. **Ambiguous Keywords**: Direct matching reduces false positives (e.g., "storm" won't match "brainstorm")

#### Severity Assessment

The system uses a **two-tier severity classification system**:

1. **Severity Level**: AWS-compliant levels (emergency, watchAndAct, advice, info, unknown)
2. **Severity Band**: User-facing urgency indicators (critical, action, monitor, info)

**Severity Determination (Multi-Method Approach):**

**Method 1: AWS (Australian Warning System) Keyword Matching**

- **Used for**: Fire and emergency service sources (RFS, CFS, Victoria ES, etc.)
- **Detection Algorithm**: Case-insensitive substring matching in description
- **AWS-Compliant Severity Levels**:
  - "Emergency Warning" → `severity: emergency`, `severityBand: critical`
  - "Watch and Act" → `severity: watchAndAct`, `severityBand: action`
  - "Advice" → `severity: advice`, `severityBand: info`
- **Exclusion Rule**: Skips matches where keyword appears as a label (e.g., "Emergency Warning:" in structured text)
- **Fallback**: If no AWS keywords match → `severity: unknown`

**Severity to Band Mapping (AWS Compliant):**

```
emergency → critical band
watchAndAct → action band
advice → info band
```

**AWS Compliance Flag (`isAwsCompliant`):**

A hazard is flagged as AWS-compliant only when BOTH conditions are true:

1. **Severity** must be one of: `emergency`, `watchAndAct`, `advice`
2. **Category** must be one of: `bushfire`, `cyclone`, `storm`, `flood`, `extremeHeat`, `damagingWinds`, `earthquake`

Examples:

- Bushfire with "Watch and Act" severity → `isAwsCompliant: true` ✓
- Bushfire with "Info" severity → `isAwsCompliant: false` (severity not AWS-compliant)
- Road closure with "Watch and Act" severity → `isAwsCompliant: false` (category not AWS-compliant)
- Cyclone with "Emergency Warning" → `isAwsCompliant: true` ✓

**Method 2: Severity Band Keyword Matching**

- **Purpose**: Determine urgency level independent of AWS classification
- **Process**: Scans description for action-oriented keywords (case-insensitive substring match)
- **Algorithm**: First match wins (checks critical → action → monitor keywords in order)

**Critical Band Keywords** (67 keywords):

```
Life-threatening situations:
- "life-threatening", "life threatening", "threat to life", "serious threat to life"
- "extreme danger", "dangerous conditions", "catastrophic conditions"
- "you are in danger", "you may be in danger", "you are at risk"
- "your life may be at risk", "immediate threat", "immediate danger"

Evacuation directives:
- "act now", "you must act now", "act immediately"
- "leave immediately", "evacuate immediately", "evacuate now"
- "leave now", "leave the area now", "it is too late to leave"
- "it may be too late to leave", "do not return to the area"

Shelter instructions:
- "seek shelter immediately", "take shelter immediately"
- "shelter in place", "stay inside and away from windows"
- "stay indoors and away from windows", "do not go outside"

Area restrictions:
- "do not travel to this area", "do not enter this area"
- "keep away from the area", "keep well away from the area"
- "keep away from fallen powerlines", "stay out of the water"
- "follow emergency instructions immediately"
```

**Action Band Keywords** (40 keywords):

```
Precautionary measures:
- "take precautions", "take extra care", "take care on the roads"
- "avoid the area", "avoid this area", "avoid travel in the area"
- "avoid unnecessary travel", "delay non-essential travel"
- "use an alternative route", "expect significant delays"

Safety actions:
- "do not drive through floodwater", "do not enter floodwater"
- "do not walk through floodwater", "do not swim in this area"
- "secure loose items", "tie down loose items"
- "move vehicles under cover", "move vehicles to higher ground"
- "move livestock to higher ground"

Preparedness:
- "protect your property", "prepare your property"
- "prepare now", "prepare to leave", "prepare to evacuate"
- "make a plan", "get your plan ready", "be ready to act"
- "follow directions of emergency services"
- "check on family and neighbours", "keep children and pets indoors"
- "stay off the roads if possible"
```

**Monitor Band Keywords** (29 keywords):

```
Low-impact conditions:
- "minor flooding", "minor flood", "minor impact", "low impact"
- "localised flooding", "localised impacts", "some local impacts"

Travel advisories:
- "allow extra travel time", "expect delays", "possible delays"
- "some delays", "traffic may be affected", "services may be affected"

Situational awareness:
- "conditions may change", "if conditions worsen"
- "stay informed in case conditions change", "monitor conditions"
- "monitor the situation", "check conditions before you travel"
- "check local conditions", "monitor official updates"

Risk levels:
- "low risk", "lower risk", "reduced risk", "small impact"
```

**Fallback**: If no keywords match → `severityBand: info`

**Method 3: Numeric Threshold Mapping (Environmental Data)**

**Air Quality Index (AQI) Mapping:**

```
AQI > 300: Hazardous → critical band
AQI 151-300: Very Unhealthy → critical band
AQI 101-150: Unhealthy → action band
AQI 51-100: Moderate → monitor band (filtered out)
AQI 0-50: Good → info band (filtered out)
```

**UV Index Mapping:**

```
UV Scale (World Health Organization):
UV ≥ 11: Extreme → critical band
UV 8-10: Very High → critical band
UV 6-7: High → action band
UV 3-5: Moderate → monitor band
UV 0-2: Low → info band (filtered out)
```

**Pollen Count Mapping** (grains per cubic meter):

```
Pollen ≥ 91: Very High → critical band
Pollen 61-90: High → action band
Pollen 31-60: Moderate → monitor band
Pollen 0-30: Low → info band (filtered out)
```

**Method 4: Smartraveller Advisory Levels**

- **Detection**: Case-insensitive substring matching in level description
- **Mapping**:
  ```
  "Do not travel" → critical band
  "Reconsider your need to travel" → action band
  "Exercise a high degree of caution" → monitor band
  "Exercise normal safety precautions" → info band
  ```

**Priority and Processing Logic:**

The system applies methods in this order:

1. **For Environmental Data** (WAQI, Open-Meteo): Use numeric thresholds directly
2. **For Fire/Emergency Services**: Check AWS keywords first for severity level
3. **For All Hazards**: Check severity band keywords if band not yet determined
4. **AWS Severity Mapping**: If AWS severity detected, map to corresponding band
5. **Fallback**: `severity: unknown`, `severityBand: info`

**Complete Severity Assessment Example:**

```
Input:
Source: NSW RFS
Description: "WATCH AND ACT: Fast-moving bushfire near Smith Road.
Conditions are extremely dangerous. You may be in danger and need to
act immediately to survive. Prepare to leave immediately if threatened."

Assessment Process:

Step 1: AWS Severity Detection
- Scan for AWS keywords in description
- "WATCH AND ACT" found (case-insensitive match)
- Result: severity = "watchAndAct"

Step 2: AWS Band Mapping (Takes Precedence)
- AWS severity "watchAndAct" detected
- Apply AWS-to-band mapping: watchAndAct → action band
- Result: severityBand = "action"
- AWS mapping is FINAL and cannot be overridden

Step 3: Severity Band Keywords (Skipped for AWS-compliant hazards)
- Although description contains critical keywords:
  * "extremely dangerous"
  * "you may be in danger"
  * "act immediately"
- These keywords are IGNORED because AWS severity takes precedence
- AWS mapping always wins for fire/emergency service sources

Step 4: AWS Compliance Flag Determination
- Check TWO conditions (BOTH must be true):
  1. Severity is AWS-compliant: "watchAndAct" ✓
     - AWS severities: [emergency, watchAndAct, advice]
  2. Category is AWS-compliant: "bushfire" ✓
     - AWS categories: [bushfire, cyclone, storm, flood, extremeHeat,
       damagingWinds, earthquake]
- BOTH conditions met → isAwsCompliant = true

Output:
- severity: "watchAndAct"
- severityBand: "action"
- category: "bushfire"
- isAwsCompliant: true (severity AND category are both AWS-compliant)

Note: AWS severity-to-band mapping is absolute and cannot be overridden
by keyword matching. If severity = watchAndAct, band is ALWAYS action,
regardless of other keywords in the description.
```

**Edge Cases:**

1. **AWS Mapping Priority**: For AWS-compliant severities (emergency, watchAndAct, advice), the band mapping is absolute and cannot be changed by keyword matching
2. **Non-AWS Hazards**: Severity band keywords only apply when no AWS severity is detected
3. **No Keywords Match**: Defaults to `severity: unknown`, `severityBand: info`
4. **Multiple Keywords Match**: First match wins (critical checked first, then action, then monitor)
5. **Info Keyword Position**: "info" and "information" checked last to avoid false positives (e.g., "information" in "emergency warning information")

#### Temporal Processing

**Date/Time Parsing (Multi-Format Support):**

**Format Detection & Conversion:**

```
Supported Formats:
1. ISO 8601: "2025-12-17T10:23:00Z" → Direct parse
2. RFC 2822: "Tue, 17 Dec 2025 10:23:00 +1100" → Parse with timezone
3. Australian Date: "17/12/2025" → Parse as DD/MM/YYYY
4. US Date: "12/17/2025" → Parse as MM/DD/YYYY (source-specific)
5. Separated Date/Time: Date: "17/12/2025", Time: "14:23"
   → Combine and parse
6. Relative: "30 minutes ago" → Calculate from current time
```

**Expiration Time Calculation:**

- **Algorithm**: Based on severity level only
- **Severity-Based Expiration Rules**:

  ```
  emergency severity: 48 hours
  watchAndAct severity: 24 hours
  advice severity: 12 hours
  info severity: 6 hours
  unknown severity: 6 hours
  ```

- **Special Cases**:
  - **Source-Provided Expiration**: If source provides explicit end date/time (e.g., NSW RFS `properties.end` field, NT Fire `_dateclosed`), that value is used instead of calculated expiration
  - **Smartraveller**: No expiration (set to `null` - advisories remain active until explicitly cancelled by source)
  - **Default Fallback**: 6 hours for any unrecognized severity

**Example Temporal Processing:**

```
Input:
- pubDate: "17/12/2025"
- Time: "14:23"
- End date: Not provided by source
- Severity: "watchAndAct"
- Category: Fire (bushfire)

Processing:
1. Combine date and time: "17/12/2025 14:23"
2. Parse as DD/MM/YYYY HH:mm format
3. Convert to UTC: 2025-12-17T03:23:00Z (AEDT offset)
4. Set occurredAt: 2025-12-17T03:23:00Z
5. Calculate expiration:
   - Source did NOT provide explicit end date
   - Use severity-based expiration
   - Severity: watchAndAct → 24 hours from now
   - Current time: 2025-12-17T03:23:00Z
   - Expiry: 2025-12-18T03:23:00Z (24 hours later)

Output:
- occurredAt: 2025-12-17T03:23:00Z
- expiresAt: 2025-12-18T03:23:00Z
- timeZone: "Australia/Sydney"

Note: Category does NOT affect expiration calculation - only severity matters.
If source had provided explicit end date, that would be used instead.
```

#### Unique ID Generation

**Two-Tier ID Strategy:**

**Tier 1: Source-Provided IDs (Preferred)**

Most sources provide their own unique identifiers which are extracted and prefixed:

- **NSW RFS, CFS, Victoria ES**: Extract numeric ID from `guid` URL field

  - Example: `https://incidents.rfs.nsw.gov.au/api/v1/incidents/630789` → ID: `rfs-630789`
  - Pattern matching: `/incidents/(\d+)`, `/criimson/(\d+)`, `/incident/(\d+)`

- **RSS Feeds (NT Fire, QLD, ACT)**: Use `identifier`, `guid`, or `id` fields directly

  - Example: `<identifier>1668093</identifier>` → ID: `ntfire-1668093`

- **BoM Weather Warnings**: Generated from location name and category

  - Example: "Sydney" + "storm" → ID: `bom-sydney-storm`
  - Format: `bom-{location-normalized}-{categoryId}`

- **NT Fire (Special Case)**: Concatenate key properties when no identifier exists

  - Format: `ntfire-{eventType}-{location}-{dateNotified}` (max 50 characters)
  - Non-alphanumeric characters replaced with hyphens, lowercase

- **WA DFES**: Use warning ID from source data
  - Example: Warning ID `ABC123` → ID: `waDfes-ABC123`

**Tier 2: Generated Hash ID (Fallback)**

Only used when source provides no identifier. A deterministic hash is generated using:

- **Hash Algorithm**: SHA-256
- **Fields Used** (in exact order):
  ```json
  {
    "title": "[full title]",
    "description": "[complete description - NOT truncated]",
    "latitude": [exact value - NOT rounded],
    "longitude": [exact value - NOT rounded],
    "severity": "[severity level]"
  }
  ```
- **Process**:

  1. Create JSON object with fields above
  2. Convert to string: `JSON.stringify(data)`
  3. Generate SHA-256 hash
  4. Take first 16 characters of hex digest
  5. Result: `{16-char-hash}` (e.g., "a3f9b2c1d4e5f6a7")

  **Note**: Source prefix is already included in `hazard.id` field by the time hash is generated

**ID Assignment Logic:**

```typescript
Final ID = hazard.id || generateHazardId(hazard)
```

- If source-provided ID exists → Use it
- If not → Generate deterministic hash

**Examples by Source:**

```
NSW RFS: rfs-630789 (extracted from GUID URL)
BoM: bom-sydney-storm (location + category)
NT Fire: ntfire-bushfire-smithroad-20251217 (concatenated properties)
WAQI: a3f9b2c1d4e5f6a7 (generated hash - no source ID)
Open-Meteo: 9f8e7d6c5b4a3210 (generated hash - no source ID)
```

**Benefits of This Approach:**

- **Duplicate Prevention**: Same hazard across polling cycles → Same ID
- **Update Detection**: Changed description → Different hash → Triggers update
- **Consistency**: Deterministic algorithm ensures reproducibility
- **Source Traceability**: Source prefix identifies data origin

---

## Data Flow

### Complete Journey: From Source to User

Here's how a typical hazard moves through the system:

#### 1. Initial Detection (T+0 seconds)

```
NSW RFS publishes a new bushfire incident to their JSON API
↓
ALRT system polls the API every 15 minutes
↓
New incident detected in the JSON response
```

#### 2. Data Extraction (T+1 second)

```
System extracts:
- Title: "ADVICE: Bushfire at SMITH ROAD, OAKVILLE"
- Description: "Fire crews attending grassfire..."
- Coordinates: Latitude -34.5, Longitude 138.7
- Status: "Advice"
- Publication time: 2025-12-17 10:23:00
```

#### 3. Normalization (T+2-5 seconds)

```
Format Parsing:
- Extract fields from GeoJSON structure
- Map properties to standardized schema
↓
Geographic Processing:
- Coordinates confirmed valid: -34.5, 138.7
- Reverse geocode to address
  → Check cache (miss)
  → Call Google API
  → Result: "Smith Road, Oakville, SA 5558"
  → Store in cache (30-day TTL)
↓
Category Classification:
- Direct keyword match: "bushfire" found
- Assigned: Weather & Environment > Bushfire (AWS-compliant)
↓
Severity Assessment:
- AWS keyword detected: "Advice"
- Severity level: advice
- Severity band: info (AWS mapping)
- isAwsCompliant: true (both severity & category are AWS-compliant)
↓
Temporal Processing:
- Parse date: 17/12/2025
- Set occurredAt: 2025-12-17T10:23:00Z
- Calculate expiresAt: 2025-12-17T22:23:00Z (12 hours for advice)
↓
ID Generation:
- Extract from GUID: rfs-630789
```

#### 4. Storage (T+6 seconds)

```
Database:
- Hazard record created with unique ID
- Linked to RFS as source
- Linked to Fire category
- Geographic index updated
```

#### 5. Ongoing Updates (Every 15 minutes)

```
Continuous Monitoring:
- System re-polls RFS API every 15 minutes
- Compare with existing database records by ID
↓
If incident updated:
- Re-normalize data (detect severity/description changes)
- Update database record with new information
↓
If incident removed from source:
- Mark hazard as expired in database
```

### Parallel Processing

The system processes **multiple sources simultaneously**:

```
Time T+0: Trigger ingestion cycle
  ├── Thread 1: NSW RFS (50 incidents) → Fetch: 2s, Parse: 5s
  ├── Thread 2: BoM NSW (12 warnings) → Fetch: 1s, Parse+Geocode: 8s
  ├── Thread 3: NSW Transport (234 incidents) → Fetch: 3s, Parse: 6s
  ├── Thread 4: BoM VIC (8 warnings) → Fetch: 1s, Parse+Geocode: 5s
  ├── Thread 5: WAQI (89 stations) → Fetch: 2s, Parse: 3s
  ├── Thread 6: CFS SA (15 incidents) → Fetch: 2s, Parse: 4s
  └── ... (all other sources in parallel)

Time T+15: All sources fetched and normalized
  ↓
Time T+16-20: Database operations
  - Duplicate detection by ID
  - Insert new hazards
  - Update existing hazards
  - Batch writes for efficiency
  - Total: ~400 hazards processed
↓
Time T+20: Ingestion cycle complete
  - New hazards available in database
  - Next cycle begins at T+900 (15 minutes)
```

### Rate Limiting & Batching

To ensure system stability and API compliance:

**Parallel Processing:**

- All data sources fetched simultaneously (non-blocking)
- Each source normalized independently in parallel
- Format parsing, category classification, severity assessment happen concurrently

**Sequential Operations:**

- Geocoding for uncached locations (respects Google API rate limits of 50 req/sec)
- Cache lookup is instant (85% hit rate), only misses require API calls
- Typical: ~60 uncached locations per cycle × 20ms = ~1.2 seconds total

**Database Optimization:**

- Writes batched to minimize connection overhead
- Duplicate detection via ID lookup (indexed)
- Updates use upsert operations (insert or update in single query)

---

## Summary

The ALRT hazards ingestion and normalization pipeline is a two-stage automated system that collects and standardizes hazard information from official Australian government sources. The pipeline transforms diverse data formats into a unified, structured format through intelligent parsing, geographic processing, category classification, and severity assessment.

**Key Benefits:**

1. **Comprehensive Coverage**: Monitors 11 official data sources across all Australian states and territories
2. **Frequent Updates**: 15-minute polling cycles ensure timely hazard information
3. **Consistent Format**: All sources normalized to unified data structure with standardized fields
4. **Intelligent Classification**: Automated category mapping (7 main categories, multiple subcategories) and AWS-compliant severity determination
5. **Efficient Processing**: Parallel data collection with intelligent caching reduces API dependency by ~85%
6. **Reliable**: Robust error handling with graceful degradation when sources fail

The system operates 24/7, processing up to 500 hazards per ingestion cycle (every 15 minutes), ensuring Australians receive accurate and current emergency information from trusted official sources.

---

## Appendix: Common Scenarios

### Scenario 1: Bushfire Escalation

**Situation**: A bushfire intensifies from Advice to Watch and Act level

**Pipeline Response:**

1. **Detection**: Next polling cycle (within 15 minutes) detects updated status from NSW RFS API
2. **Duplicate Check**: Matches existing hazard by ID (rfs-630789)
3. **Change Detection**: Compares description text, detects severity keyword change
4. **Re-normalization**:
   - Severity updated: advice → watchAndAct
   - Severity band updated: info → action
   - AWS compliance maintained: true (both severity and category are AWS-compliant)
5. **Database Update**: Updates existing hazard record (no duplicate created)
6. **Expiry Update**: Adjusts expiration time from 12 hours (advice) to 24 hours (watchAndAct)

**Result**: System maintains single hazard record with updated severity, preventing duplicates while accurately reflecting escalating conditions

### Scenario 2: Poor Air Quality

**Situation**: Air quality in Melbourne deteriorates to unhealthy levels, then improves

**Pipeline Response:**

1. **Detection**: WAQI API reports AQI of 165 (Unhealthy) for Melbourne monitoring station
2. **Normalization**:
   - Numeric threshold mapping: AQI 165 → action severity band
   - Category: Health & Air > Air Quality Alert
   - Coordinates: Direct from WAQI station (-37.8136, 144.9631)
   - Location name: "Melbourne, VIC"
3. **ID Generation**: Hash-based ID created (no source ID provided by WAQI)
4. **Storage**: New air quality hazard stored with action band severity
5. **Monitoring**: System continues polling WAQI every 15 minutes
6. **Improvement Detected**: Next cycle reports AQI of 95 (Moderate)
   - AQI 95 maps to monitor band (below action threshold)
   - Monitor band hazards are filtered out (not stored)
   - Existing hazard marked as expired in database
7. **No Duplicates**: Improved condition not created as new hazard

**Result**: System tracks air quality hazards only when they reach action or critical bands, automatically expiring them when conditions improve to acceptable levels

**Database Storage** (T+15-20 seconds):

- Total: 38 hazards created (3 BoM + 23 Transport + 12 RFS)
- No duplicates (different source prefixes and specific locations)
- All records linked to respective sources
- Geographic indexes updated for location-based queries

**Result**: System creates comprehensive, non-duplicate hazard coverage from multiple authoritative sources, each contributing domain-specific information about the same weather event
