# Steam Tag Weights Integration Plan

## Problem Analysis

### Current Issue
Steam integration works as a **parallel scoring system** instead of integrating with the existing preference learning architecture. This causes:

- No visible tag preferences from Steam playtime data
- Steam preferences don't show in preference summary component
- Two separate systems instead of unified preference learning

### Current Architecture (Broken)

**Voting System (Correct):**
- Updates `this.weightVector` directly with tag weights via `updateWeightsFromVector()`
- Preference summary reads from `this.weightVector` to show liked/disliked tags
- Scoring uses dot product of game vector with `this.weightVector`

**Steam System (Wrong):**
- Creates separate `steamProfile.preferenceMultipliers` map
- Never touches `this.weightVector`
- Uses parallel `enhanceGameScore()` method
- Steam preferences invisible to preference summary

## Solution Implementation Plan

### Phase 1: Core Steam Weight Vector Integration

#### 1.1 Add Steam Weight Vector Population Method
**File:** `src/app/game-picker/services/preference.service.ts`

```typescript
/**
 * Populate weight vector from Steam playtime analysis.
 * Converts Steam library analysis into preference weights.
 */
populateWeightVectorFromSteam(steamData: SteamPlayerLookupResponse, allGames: GameRecord[]): void {
  if (!this.tagDict) return;
  
  // Generate Steam preference profile
  const steamProfile = this.steamIntegrationService.generatePreferenceProfile(steamData, allGames);
  
  // Convert Steam preferences to weight vector updates
  // Use similar logic to voting but with Steam-derived factors
  
  // Mark as Steam-derived preferences for tracking
  this.updatePreferenceSummary();
  this.saveToLocalStorage();
}
```

#### 1.2 Steam Learning Rate and Integration
- Use moderate learning rate for Steam preferences (e.g., 0.3x normal)
- Apply Steam weights as "synthetic votes" on heavily played games
- Ensure Steam weights show up in preference summary

#### 1.3 Steam Data Loading Integration
**File:** `src/app/game-picker/components/game-picker-page/game-picker-page.component.ts`

```typescript
onSteamDataLoaded(steamData: SteamPlayerLookupResponse): void {
  // Current logic...
  
  // NEW: Populate weight vector from Steam data
  this.preferenceService.populateWeightVectorFromSteam(steamData, this.games);
  
  // Auto-navigate to recommendations...
}
```

### Phase 2: Hybrid Steam + Voting System

#### 2.1 Steam as Initial Preferences
- Steam weights become the "starting point" (like pre-voting)
- Voting then refines and updates these Steam-derived preferences
- Sliding window decay allows votes to override Steam preferences over time

#### 2.2 Preference Source Tracking
- Add metadata to track Steam-derived vs vote-derived weights
- Visual indicators in preference summary to show source
- Logging to distinguish Steam vs voting preference updates

### Phase 3: UX Integration

#### 3.1 Preference Summary Enhancement
- Show Steam-derived tag preferences immediately when data loads
- Visual indicators (icons, colors) to distinguish Steam vs voting preferences
- Clear feedback that Steam library analysis is influencing recommendations

#### 3.2 Steam Tab Integration
- Show how Steam playtime translates to tag preferences
- Real-time updates as preferences are refined by voting
- Display correlation between playtime and tag weights

## Implementation Steps

### Step 1: Steam Weight Vector Population
1. Add `populateWeightVectorFromSteam()` method to PreferenceService
2. Convert Steam playtime data to weight vector format using existing infrastructure
3. Call method when Steam data loads

### Step 2: Test and Verify Integration
1. Load Steam data and verify tag preferences appear in preference summary
2. Test that voting still works and blends with Steam preferences
3. Verify recommendation scoring uses unified system

### Step 3: UX Enhancements
1. Add visual indicators for Steam vs voting preferences
2. Update Steam tab to show derived tag preferences
3. Add debugging/logging for preference source tracking

### Step 4: Testing and Refinement
1. Test with various Steam libraries (small, large, diverse)
2. Verify preference learning still works correctly with voting
3. Ensure Steam preferences provide good initial recommendations

## Expected Outcomes

### Immediate Benefits
- Steam playtime analysis shows as visible tag preferences
- Unified preference learning system
- Steam provides intelligent initial preferences

### Long-term Benefits
- Seamless integration between Steam data and voting
- Better initial recommendations for Steam users
- Consistent preference learning architecture

## Technical Notes

### Weight Vector Structure
- Steam preferences use same weight vector as voting
- Steam-derived weights should be moderate (not extreme)
- Preserve ability for voting to override Steam preferences

### Preference Persistence
- Steam-derived preferences persist with voting preferences
- Clear distinction in storage between sources
- Proper cleanup on reset/restart

### Performance Considerations
- Steam weight population should be fast (one-time on load)
- Existing preference summary updates should handle Steam weights
- No impact on voting performance