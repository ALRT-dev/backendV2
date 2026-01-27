# AI Prompts System Documentation

## Overview

This document explains how the ALRT platform uses artificial intelligence to process and communicate hazard information. The AI system ensures that all hazard alerts—whether from official government sources or community reports—are clear, consistent, accurate, and provide appropriate guidance to keep people safe.

The platform uses five categories of AI prompts (instructions given to the AI) that are tailored to different types of hazards and sources. Most prompt types have four versions corresponding to different severity levels, ensuring the tone and recommendations match the urgency of each situation.

---

## Table of Contents

1. [How AI Prompts Work](#how-ai-prompts-work)
2. [The Five Prompt Categories](#the-five-prompt-categories)
3. [Understanding Severity Bands](#understanding-severity-bands)
4. [Prompt Selection Logic](#prompt-selection-logic)
5. [Continuous Improvement](#continuous-improvement)

---

## How AI Prompts Work

AI prompts are detailed instructions that tell the artificial intelligence how to process hazard information. Think of them as specialized guides that ensure every alert is:

- **Clear and easy to understand** - Using plain language that everyone can follow
- **Accurate** - Stating only verified information from trusted sources
- **Actionable** - Providing specific steps people should take
- **Appropriate** - Matching the tone and urgency to the type and severity of the situation

### What Goes Into a Prompt (Inputs)

When processing a hazard alert, the AI receives the following information as input:

- **Title**: The original alert title or headline
- **Description**: Detailed information about the hazard (what's happening, where, when, why)
- **Location**: Geographic information (city, suburb, region, or coordinates)
- **Category**: The type of hazard (e.g., Fire, Flood, Severe Weather, Air Quality, Transport, Travel Advisory)
- **Source Agency**: Which organization issued the alert (e.g., NSW RFS, Bureau of Meteorology, Smartraveller)
- **Severity Level**: The urgency level (INFO, MONITOR, ACTION, or CRITICAL) - _Note: Not applicable for user-reported alerts_
- **Additional Data**: Category-specific information such as:
  - AQI values and pollutant levels for air quality alerts
  - Travel advisory levels for international destinations
  - Weather measurements (wind speed, rainfall, temperature)
  - Traffic impact details

### What Comes Out of a Prompt (Outputs)

The AI processes all the input information and generates a standardized alert summary with four key components:

1. **Title** (80 characters maximum)

   - Concise, descriptive headline
   - Location-specific when relevant
   - Uses clear, accessible language

2. **Summary** (One sentence)

   - Captures the essential information about the hazard
   - Includes source attribution for transparency
   - States what is happening and where

3. **Calls to Action** (2-4 specific items)

   - Clear, actionable steps people should take
   - Prioritized by importance and urgency
   - Appropriate to the severity level and hazard type

4. **Confidence Level** (high, medium, or low)
   - **High**: Detailed, specific, verifiable information from trusted sources
   - **Medium**: Reasonable information but some ambiguity or missing details
   - **Low**: Vague, unclear, or potentially unreliable information

---

## The Five Prompt Categories

The ALRT platform uses five distinct categories of AI prompts. Each serves a specific purpose in the hazard communication system.

### 1. User-Reported Alert Prompt

**What it does**: Processes hazard reports submitted by community members through the app.

**Number of versions**: **One** - This prompt type does not have severity-based variations because all user-reported content is treated as unverified, requiring a consistently cautious approach.

**Key characteristics**:

- Checks for inappropriate language (profanity, sexual content, discriminatory language)
- Uses cautious, unverified language: "A user has reported..." rather than stating facts
- Keeps recommendations soft and non-directive
- Protects user privacy by showing only suburb-level locations, never exact addresses
- Maintains consistent cautious tone for all user reports

**Used for**: Any hazard reported by a member of the public through the ALRT app.

**Example Input**:

```
Title: "Fire near shopping center"
Description: "I saw flames and smoke coming from the bushland behind Westfield"
Location: City Beach, Perth
Category: Fire
```

**Example Output**:

```
Title: "Fire near shopping center"
Summary: "A user has reported possible fire activity near City Beach."
Calls to Action:
  - Stay aware of local conditions and check official updates if needed.
  - Monitor your surroundings until more information is available.
Confidence: medium
```

---

### 2. Official Alert Prompts

**What they do**: Process alerts from trusted government agencies and emergency services.

**Number of versions**: **Four** - One for each severity band (INFO, MONITOR, ACTION, CRITICAL). Each version uses a tone appropriate to the severity level.

**Key characteristics**:

- Uses authoritative language since information comes from official sources
- States information as fact rather than as unverified reports
- Can be direct with safety instructions
- Includes agency attribution for transparency
- Tone adjusts from informative to urgent based on severity

**Used for**: Alerts from agencies like:

- NSW Rural Fire Service
- Bureau of Meteorology
- Victoria Emergency Services
- Queensland Fire Department
- DFES Western Australia
- All other official emergency services across Australia

#### INFO Version - Informative Tone

General awareness, no immediate action needed.

**Example Input**:

```
Title: "Traffic Update - M1 Motorway"
Description: "Minor delays on M1 northbound near Wahroonga due to scheduled maintenance. One lane closed."
Location: Wahroonga, Sydney
Agency: NSW Transport
Severity: INFO
```

**Example Output**:

```
Title: "Traffic Delay - M1 Motorway Wahroonga"
Summary: "Minor traffic delays are reported on the M1 near Wahroonga due to maintenance, as advised by NSW Transport."
Calls to Action:
  - Allow extra travel time for your journey.
  - Consider alternative routes if available.
Confidence: high
```

#### MONITOR Version - Preparatory Tone

Elevated awareness, prepare for possible action.

**Example Input**:

```
Title: "Weather Watch - Severe Storms Possible"
Description: "Conditions are favorable for severe thunderstorms to develop this afternoon across the Sydney region."
Location: Greater Sydney
Agency: Bureau of Meteorology
Severity: MONITOR
```

**Example Output**:

```
Title: "Storm Watch - Greater Sydney"
Summary: "Severe thunderstorms may develop across Greater Sydney this afternoon, as advised by Bureau of Meteorology."
Calls to Action:
  - Secure loose outdoor items now.
  - Prepare for possible power outages.
  - Monitor weather updates throughout the day.
Confidence: high
```

#### ACTION Version - Directive Tone

Clear danger present, take protective actions now.

**Example Input**:

```
Title: "Severe Weather Warning"
Description: "Severe thunderstorms producing damaging winds and large hail are affecting the Illawarra region. Winds may exceed 90km/h."
Location: Illawarra, NSW
Agency: Bureau of Meteorology
Severity: ACTION
```

**Example Output**:

```
Title: "Severe Weather Warning - Illawarra"
Summary: "Severe thunderstorms with damaging winds and large hail are affecting Illawarra, as reported by Bureau of Meteorology."
Calls to Action:
  - Move vehicles under cover or away from trees.
  - Secure loose items around your property.
  - Stay indoors away from windows.
  - Monitor warnings and emergency alerts.
Confidence: high
```

#### CRITICAL Version - Urgent Tone

Imminent threat, immediate action required.

**Example Input**:

```
Title: "Emergency Warning - Bushfire"
Description: "A fast-moving bushfire is burning out of control in Perth Hills. Embers are ahead of the fire front. Lives and homes are under threat. Leave now if safe to do so."
Location: Perth Hills, WA
Agency: DFES
Severity: CRITICAL
```

**Example Output**:

```
Title: "Emergency Warning - Bushfire in Perth Hills"
Summary: "A fast-moving bushfire is threatening lives and homes in Perth Hills, as reported by DFES."
Calls to Action:
  - Leave immediately if the way is clear.
  - If you cannot leave, shelter in your home away from the fire.
  - Call 000 if you need emergency assistance.
  - Listen to ABC Local Radio for updates.
Confidence: high
```

---

### 3. Official AWS Alert Prompts

**What they do**: Process official alerts that follow the Australian Warning System (AWS) standards.

**Number of versions**: **Four** - One for each severity band (INFO, MONITOR, ACTION, CRITICAL). Each version ensures AWS-compliant terminology while adjusting tone for the severity level.

**Key characteristics**:

- Uses specific Australian Warning System terminology
- Includes official alert level classifications
- Follows national emergency communication standards
- Maintains AWS compliance while adjusting urgency
- Tone ranges from informative to commanding based on severity

**Used for**: Emergency alerts requiring AWS compliance, particularly major emergencies like bushfires and severe weather events from agencies that follow AWS standards.

#### INFO Version - Informative Tone

Awareness messaging using AWS-compliant language.

**Example Output**:

```
Title: "Advice - Controlled Burn"
Summary: "A controlled burn is being conducted in Blue Mountains National Park, as advised by NSW RFS."
Calls to Action:
  - Expect smoke in the area over the next few hours.
  - Close windows if affected by smoke.
  - Monitor updates from NSW RFS.
Confidence: high
```

#### MONITOR Version - Preparatory Tone

Watch and prepare using AWS terminology.

**Example Output**:

```
Title: "Watch and Act - Grassfire"
Summary: "A grassfire is burning near Bendigo and conditions may change, as reported by CFA Victoria."
Calls to Action:
  - Prepare your property for bushfire.
  - Monitor conditions and be ready to act.
  - Listen to emergency broadcasts.
Confidence: high
```

#### ACTION Version - Directive Tone

Take action now using AWS standards.

**Example Output**:

```
Title: "Watch and Act - Bushfire"
Summary: "A bushfire is burning in the Adelaide Hills and posing a threat to properties, as reported by CFS South Australia."
Calls to Action:
  - Activate your bushfire survival plan now.
  - Secure your property and monitor conditions.
  - If your plan is to leave, do so now.
Confidence: high
```

#### CRITICAL Version - Urgent Tone

Emergency level using AWS emergency warning protocols.

**Example Output**:

```
Title: "Emergency Warning - Bushfire"
Summary: "It is too late to leave. A bushfire is impacting homes in Kinglake, as reported by CFA Victoria."
Calls to Action:
  - Shelter in your home immediately.
  - Stay away from windows and external walls.
  - Call 000 if your life is in danger.
  - Listen to emergency broadcasts for updates.
Confidence: high
```

---

### 4. Category-Specific Prompts

**What they do**: Process hazards that belong to specific categories requiring specialized handling and terminology.

**Number of versions**: **Four** - One for each severity band (INFO, MONITOR, ACTION, CRITICAL). Each version uses category-appropriate language and tone suited to the severity level.

**Example category**: Air Quality

Air quality prompts are tailored to communicate health impacts and provide AQI-based recommendations.

**Key characteristics** (Air Quality example):

- Health-focused recommendations tailored to AQI levels
- Special attention to vulnerable populations (breathing conditions, elderly, children)
- Always includes AQI (Air Quality Index) numbers for transparency
- Uses Australian spelling conventions
- Tone escalates from awareness to urgent health protection

**Used for**: Hazards that require category-specific expertise and terminology. Currently implemented for Air Quality alerts from monitoring stations across Australia.

#### INFO Version - Informative Tone

Good air quality, minimal health concerns.

**Example Input**:

```
Location: Sydney CBD
AQI: 45
PM2.5: 12 μg/m³
Category: Air Quality
Source: WAQI
Severity: INFO
```

**Example Output**:

```
Title: "Good Air Quality - Sydney"
Summary: "Air quality is good in Sydney with AQI at 45, as reported by WAQI."
Calls to Action:
  - No health precautions necessary.
  - Air quality is suitable for outdoor activities.
  - Ideal conditions for all outdoor activities.
Confidence: high
```

#### MONITOR Version - Preparatory Tone

Moderate air quality, some concern for sensitive individuals.

**Example Input**:

```
Location: Brisbane
AQI: 78
PM2.5: 28 μg/m³
Category: Air Quality
Source: WAQI
Severity: MONITOR
```

**Example Output**:

```
Title: "Moderate Air Quality - Brisbane"
Summary: "Air quality is acceptable in Brisbane with AQI at 78, as reported by WAQI."
Calls to Action:
  - Unusually sensitive people should consider limiting prolonged outdoor activity.
  - Monitor air quality updates throughout the day.
  - General public can continue normal activities.
Confidence: high
```

#### ACTION Version - Directive Tone

Poor air quality, health effects for general population.

**Example Input**:

```
Location: Rockingham
AQI: 125
PM2.5: 55 μg/m³
Category: Air Quality
Source: WAQI
Severity: ACTION
```

**Example Output**:

```
Title: "Poor Air Quality - Rockingham"
Summary: "Air quality is poor near Rockingham with AQI at 125, as reported by WAQI."
Calls to Action:
  - Limit outdoor activities if you have breathing conditions.
  - Monitor updates from health authorities.
  - Seek medical help if breathing worsens.
  - Consider wearing a mask if you must go outside.
Confidence: high
```

#### CRITICAL Version - Urgent Tone

Hazardous air quality, health emergency for everyone.

**Example Input**:

```
Location: Melbourne
AQI: 320
PM2.5: 285 μg/m³
Category: Air Quality
Source: WAQI
Severity: CRITICAL
```

**Example Output**:

```
Title: "Hazardous Air Quality - Melbourne"
Summary: "Air quality is hazardous near Melbourne with AQI at 320, as reported by WAQI."
Calls to Action:
  - Stay indoors immediately. Do not go outside.
  - Keep windows and doors closed.
  - Use air purifiers if available.
  - Call 000 if you have severe breathing difficulty or chest pain.
Confidence: high
```

---

### 5. Source-Specific Prompts

**What they do**: Process hazards from specific data sources that require unique handling, terminology, or formatting requirements.

**Number of versions**: **Four** - One for each severity band (INFO, MONITOR, ACTION, CRITICAL). Each version uses source-appropriate language and tone suited to the severity level.

**Example source**: Smartraveller

Smartraveller prompts are tailored to communicate Australian Government travel advisories using official terminology.

**Key characteristics** (Smartraveller example):

- Country/region-specific travel advisories
- Graduated response levels matching official Smartraveller categories
- Registration reminders for travelers
- DFAT contact information for critical situations
- Uses exact terminology from Australian government travel advisories
- Tone escalates from advisory to prohibitive based on severity

**Used for**: Hazards that require source-specific expertise and terminology. Currently implemented for international travel advisories from Smartraveller covering destinations worldwide.

#### INFO Version - Informative Tone

Exercise normal safety precautions.

**Example Input**:

```
Destination: New Zealand
Advice Level: Exercise normal safety precautions
Reasons: General crime, natural disasters
Source: Smartraveller
Severity: INFO
```

**Example Output**:

```
Title: "Travel Advice - New Zealand"
Summary: "Australian Government advises exercising normal safety precautions for New Zealand, as reported by Smartraveller."
Calls to Action:
  - Exercise normal safety precautions.
  - Stay aware of your surroundings.
  - Monitor local media for updates.
Confidence: high
```

#### MONITOR Version - Preparatory Tone

Exercise a high degree of caution.

**Example Input**:

```
Destination: Philippines
Advice Level: Exercise a high degree of caution
Reasons: Terrorism, civil unrest, kidnapping risk in some areas
Source: Smartraveller
Severity: MONITOR
```

**Example Output**:

```
Title: "Travel Advisory - Philippines"
Summary: "Australian Government advises exercising a high degree of caution in Philippines due to terrorism and civil unrest, as reported by Smartraveller."
Calls to Action:
  - Exercise a high degree of caution.
  - Avoid affected areas where possible.
  - Follow advice from local authorities.
  - Register your travel plans with Smartraveller.
Confidence: high
```

#### ACTION Version - Directive Tone

Reconsider your need to travel.

**Example Input**:

```
Destination: Lebanon
Advice Level: Reconsider your need to travel
Reasons: Volatile security situation, terrorism, civil unrest
Source: Smartraveller
Severity: ACTION
```

**Example Output**:

```
Title: "Travel Warning - Lebanon"
Summary: "Australian Government advises reconsidering your need to travel to Lebanon due to volatile security situation, as reported by Smartraveller."
Calls to Action:
  - Reconsider your need to travel.
  - If already there, consider leaving.
  - Register with Smartraveller immediately.
  - Have an exit plan and keep travel documents accessible.
  - Monitor DFAT advice regularly.
Confidence: high
```

#### CRITICAL Version - Urgent Tone

Do not travel - extreme danger.

**Example Input**:

```
Destination: Syria
Advice Level: Do not travel
Reasons: Armed conflict, terrorism, kidnapping, extreme danger to life
Source: Smartraveller
Severity: CRITICAL
```

**Example Output**:

```
Title: "Travel Ban - Syria"
Summary: "Australian Government advises do not travel to Syria due to armed conflict and terrorism, as reported by Smartraveller."
Calls to Action:
  - Do not travel to this location under any circumstances.
  - If already there, leave immediately if safe to do so.
  - Contact DFAT on 1300 555 135 for emergency assistance.
  - Register with the nearest Australian embassy or consulate.
Confidence: high
```

---

## Understanding Severity Bands

All hazards in the ALRT system are classified into one of four severity bands. Each band represents a different level of threat and requires a correspondingly appropriate tone and set of recommendations.

### The Four Severity Bands

**1. INFO (Informational)**

- **Tone**: Calm, informative, educational
- **Purpose**: General awareness, no immediate action needed
- **Language style**: "Be aware", "Monitor", "Stay informed"
- **Example situations**: Good air quality, minor traffic delays, routine travel advisories

**2. MONITOR (Watch and Prepare)**

- **Tone**: Slightly elevated, preparatory
- **Purpose**: Elevated awareness, prepare for possible action
- **Language style**: "Prepare", "Consider", "Be ready"
- **Example situations**: Moderate air quality, weather watch, heightened travel caution, developing situations

**3. ACTION (Take Protective Steps)**

- **Tone**: Serious, directive, commanding
- **Purpose**: Clear danger present, take protective actions now
- **Language style**: "Take action", "Avoid", "Protect", "Limit"
- **Example situations**: Poor air quality, severe weather warnings, travel not recommended, threats to property

**4. CRITICAL (Immediate Life Safety)**

- **Tone**: Urgent, commanding, emergency
- **Purpose**: Imminent threat to life, immediate action required
- **Language style**: "Leave immediately", "Do not", "Emergency", "Call 000"
- **Example situations**: Hazardous air quality, emergency fire warnings, do not travel orders, imminent threats to life

### How Severity Affects Prompts

**Prompts with Severity Variations** (Official, Official AWS, Category-Specific, Source-Specific):
Each severity band has its own version of the prompt with appropriate tone, terminology, and recommendations:

| Prompt Type       | INFO Tone   | MONITOR Tone | ACTION Tone | CRITICAL Tone |
| ----------------- | ----------- | ------------ | ----------- | ------------- |
| Official Alert    | Informative | Preparatory  | Directive   | Urgent        |
| Official AWS      | Informative | Preparatory  | Directive   | Urgent        |
| Category-Specific | Informative | Preparatory  | Directive   | Urgent        |
| Source-Specific   | Informative | Preparatory  | Directive   | Urgent        |

**Prompt without Severity Variations** (User-Reported):
The User-Reported Alert prompt maintains a consistently cautious tone across all severity levels because:

- Information is unverified from community sources
- Must never imply urgency or certainty
- Always uses soft, non-directive language
- Protects against inappropriate escalation of unconfirmed reports

---

## Prompt Selection Logic

The system intelligently selects the appropriate prompt and severity version based on the hazard's source, category, and severity level. Here's how the selection process works:

### Selection Priority

The system follows this order when choosing which prompt type and version to use:

#### Priority 1: Source-Specific Prompts

If a hazard comes from a source with its own specialized prompt:

**Example: Smartraveller Travel Advisories**

- **Uses**: Source-Specific Prompt (Smartraveller) → appropriate severity version
- **Why**: Travel advisories require specific Australian Government terminology and DFAT contact protocols
- **Versions**: 4 (INFO, MONITOR, ACTION, CRITICAL)

#### Priority 2: Category-Specific Prompts

If a hazard belongs to a category with its own specialized prompt:

**Example: Air Quality Hazards**

- **Uses**: Category-Specific Prompt (Air Quality) → appropriate severity version
- **Why**: Air quality requires health-focused language tied to AQI thresholds
- **Versions**: 4 (INFO, MONITOR, ACTION, CRITICAL)

#### Priority 3: AWS-Compliant Prompts

If the hazard is flagged as Australian Warning System compliant:

**Official Emergency Alerts from AWS-Compliant Agencies**

- **Uses**: Official AWS Alert Prompt → appropriate severity version
- **Why**: Must follow national emergency communication standards
- **Sources**: NSW RFS, CFA, CFS, and other AWS-compliant agencies
- **Versions**: 4 (INFO, MONITOR, ACTION, CRITICAL)

#### Priority 4: Official Alert Prompts

If the hazard comes from an official government agency:

**Official Government Agencies**

- **Uses**: Official Alert Prompt → appropriate severity version
- **Sources**: NSW Transport, Bureau of Meteorology, emergency services
- **Characteristics**: Authoritative language, factual statements
- **Versions**: 4 (INFO, MONITOR, ACTION, CRITICAL)

#### Priority 5: User-Reported Alert Prompt

If the hazard is reported by a community member:

**Community Members**

- **Uses**: User-Reported Alert Prompt → single version for all severities
- **Sources**: ALRT app users
- **Characteristics**: Unverified language, cautious tone, content moderation
- **Versions**: 1 (same for all severity levels)

### Real-World Scenarios

#### Scenario 1: Bushfire Emergency from NSW RFS (AWS-Compliant)

- **Source**: NSW Rural Fire Service (AWS-compliant agency)
- **Category**: Fire
- **Severity**: CRITICAL
- **Prompt Selected**: Official AWS Alert Prompt → CRITICAL Version
- **Why**: NSW RFS follows AWS standards, so AWS-compliant prompt takes priority
- **Output Tone**: Urgent, emergency language using AWS terminology
- **Result**:
  ```
  Title: "Emergency Warning - Bushfire in Blue Mountains"
  Summary: "A fast-moving bushfire is threatening lives and homes in Katoomba, as reported by NSW Rural Fire Service."
  Calls to Action:
    - Leave immediately if the way is clear.
    - If you cannot leave, shelter in your home away from the fire.
    - Call 000 if you need emergency assistance.
    - Listen to ABC Local Radio for updates.
  Confidence: high
  ```

#### Scenario 2: Community Member Reports Smoke

- **Source**: ALRT app user
- **Category**: Fire
- **Prompt Selected**: User-Reported Alert Prompt → Single Version
- **Why**: User-reported content always uses the cautious user prompt
- **Output Tone**: Consistently cautious, unverified language
- **Result**:
  ```
  Title: "Smoke reported"
  Summary: "A user has reported possible smoke activity near Katoomba."
  Calls to Action:
    - Stay aware of local conditions and check official updates if needed.
    - Monitor your surroundings until more information is available.
  Confidence: medium
  ```

#### Scenario 3: Smartraveller Updates Syria Travel Advice

- **Source**: Smartraveller
- **Category**: Travel Advisory
- **Severity**: CRITICAL
- **Prompt Selected**: Source-Specific Prompt (Smartraveller) → CRITICAL Version
- **Why**: Smartraveller has its own specialized prompt for travel advisories
- **Output Tone**: Prohibitive, includes DFAT emergency contact
- **Result**:
  ```
  Title: "Travel Ban - Syria"
  Summary: "Australian Government advises do not travel to Syria due to armed conflict and terrorism, as reported by Smartraveller."
  Calls to Action:
    - Do not travel to this location under any circumstances.
    - If already there, leave immediately if safe to do so.
    - Contact DFAT on 1300 555 135 for emergency assistance.
    - Register with the nearest Australian embassy or consulate.
  Confidence: high
  ```

#### Scenario 4: Air Quality Reaches Unhealthy Levels

- **Source**: World Air Quality Index (WAQI)
- **Category**: Air Quality
- **Severity**: ACTION
- **Prompt Selected**: Category-Specific Prompt (Air Quality) → ACTION Version
- **Why**: Air Quality category has its own specialized prompt
- **Output Tone**: Directive, health-focused with AQI number
- **Result**:
  ```
  Title: "Poor Air Quality - Sydney"
  Summary: "Air quality is poor near Sydney with AQI at 125, as reported by WAQI."
  Calls to Action:
    - Limit outdoor activities if you have breathing conditions.
    - Monitor updates from health authorities.
    - Seek medical help if breathing worsens.
    - Consider wearing a mask if you must go outside.
  Confidence: high
  ```

#### Scenario 5: Bureau of Meteorology Storm Warning

- **Source**: Bureau of Meteorology
- **Category**: Severe Weather
- **Severity**: ACTION
- **AWS Compliant**: Yes
- **Prompt Selected**: Official AWS Alert Prompt → ACTION Version
- **Why**: BoM alert is flagged as AWS-compliant
- **Output Tone**: Directive using AWS terminology
- **Result**:
  ```
  Title: "Severe Weather Warning - Greater Sydney"
  Summary: "Severe thunderstorms producing damaging winds and large hail are affecting Greater Sydney, as reported by Bureau of Meteorology."
  Calls to Action:
    - Move vehicles under cover or away from trees.
    - Secure loose outdoor items.
    - Stay indoors away from windows.
    - Monitor warnings and emergency alerts.
  Confidence: high
  ```

#### Scenario 6: Road Incident from NSW Transport

- **Source**: NSW Transport
- **Category**: Transport
- **Severity**: INFO
- **AWS Compliant**: No
- **Prompt Selected**: Official Alert Prompt → INFO Version
- **Why**: Official source without AWS compliance or special category uses standard official prompt
- **Output Tone**: Informative, factual
- **Result**:
  ```
  Title: "Traffic Delay - M1 Pacific Motorway"
  Summary: "Minor traffic delays are reported on the M1 northbound near Wahroonga due to maintenance, as advised by NSW Transport."
  Calls to Action:
    - Allow extra travel time for your journey.
    - Consider alternative routes if available.
  Confidence: high
  ```

#### Scenario 7: User Reports Flooding (During Heavy Rain)

- **Source**: ALRT app user
- **Category**: Flood
- **Prompt Selected**: User-Reported Alert Prompt → Single Version
- **Why**: User content always uses cautious prompt
- **Output Tone**: Consistently cautious, unverified language
- **Result**:
  ```
  Title: "Flooding reported"
  Summary: "A user has reported possible flooding near Penrith."
  Calls to Action:
    - Stay aware of local conditions and check official updates if needed.
    - Monitor your surroundings until more information is available.
  Confidence: low
  ```

_Note: User-reported alerts always maintain a cautious tone because unverified reports should never use emergency language._

---

## Continuous Improvement

The prompt system is designed to be maintainable and improvable:

- Prompts are stored in the database and can be updated without code changes
- Each prompt has a version history tracking who created/updated it and when
- Prompts can be tested and refined based on real-world performance
- New prompt types can be added for new hazard categories or sources
- Administrators have full control through a management interface

---

## Summary

The ALRT platform uses five different types of AI prompts to process and communicate hazard information. Each prompt type serves a specific purpose and ensures that alerts are communicated clearly, accurately, and appropriately based on their source and severity.

### The Five Prompt Types

1. **User-Reported Alert Prompt** - Processes hazard reports submitted by community members through the ALRT app
2. **Official Alert Prompts** - Handles alerts from trusted government agencies and emergency services
3. **Official AWS Alert Prompts** - Processes alerts that follow Australian Warning System (AWS) standards
4. **Category-Specific Prompts** - Manages hazards belonging to specific categories requiring specialized terminology (e.g., Air Quality)
5. **Source-Specific Prompts** - Handles hazards from specific data sources with unique requirements (e.g., Smartraveller)

### Prompt Versions and Tone Variations

The system uses different versions of prompts based on severity levels:

- **User-Reported Alert Prompt**: Has only **one version** that maintains a consistently cautious tone for all situations, since user-reported information is unverified.

- **Official, Official AWS, Category-Specific, and Source-Specific Prompts**: Each has **four versions** corresponding to different severity bands, with distinct tones for each:
  1. **INFO** - Uses an informative, educational tone for general awareness
  2. **MONITOR** - Uses a preparatory tone indicating elevated awareness and potential action
  3. **ACTION** - Uses a directive, commanding tone for clear danger requiring immediate protective steps
  4. **CRITICAL** - Uses an urgent, emergency tone for imminent life-threatening situations

### Input and Output Structure

**What Goes In (Inputs)**:

- Title and description of the hazard
- Geographic location (city, suburb, region)
- Hazard category (Fire, Flood, Air Quality, Travel Advisory, etc.)
- Source agency or reporting entity
- Severity level (INFO, MONITOR, ACTION, CRITICAL) for official alerts
- Category-specific data (e.g., AQI values for air quality, advisory levels for travel)

**What Comes Out (Outputs)**:
Every processed alert includes four standardized components:

1. **Title** - Concise headline (maximum 80 characters)
2. **Summary** - One-sentence description with source attribution
3. **Calls to Action** - 2-4 specific steps people should take
4. **Confidence Level** - High, medium, or low

### How Prompts Are Selected

The system intelligently selects the appropriate prompt type and version using a priority hierarchy:

1. If the hazard is from a specific source with specialized requirements → **Source-Specific Prompt** (e.g., Smartraveller)
2. If the hazard belongs to a category requiring specialized handling → **Category-Specific Prompt** (e.g., Air Quality)
3. If the alert must follow Australian Warning System standards → **Official AWS Alert Prompt**
4. If from an official government agency or emergency service → **Official Alert Prompt**
5. If submitted by a community member → **User-Reported Alert Prompt**

This system ensures that every hazard alert is processed with the most appropriate language, tone, and recommendations for its specific context, helping keep Australians safe through clear and consistent emergency communication.
