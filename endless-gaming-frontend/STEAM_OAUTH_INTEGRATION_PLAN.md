# Steam OAuth Integration Plan

## Overview

This plan outlines the integration of Steam OAuth authentication to extract user game libraries and hours played data, creating sophisticated initial preference vectors that blend with the existing voting system for dramatically improved recommendations.

## Problem Statement

- **Cold Start Problem**: New users receive generic recommendations until they complete 10-20 votes
- **Preference Discovery Gap**: Voting preferences might not reflect actual play patterns
- **Limited Personalization**: Current system only learns from pairwise comparisons, missing rich behavioral data
- **Session Isolation**: Preferences don't persist meaningfully across sessions without vote history

## Solution Architecture

### Three-Layer Preference System

```
┌─────────────────────────────────────────────────────────────┐
│                    Final Game Score                         │
│  = steamWeight * steamScore + voteWeight * voteScore        │
└─────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
┌───────────▼──────────┐                ┌────────▼─────────┐
│   Steam-Derived      │                │  Vote-Derived    │
│  Base Preferences    │                │    Dynamic       │
│                      │                │  Preferences     │
│ • Hours played       │                │ • SGD learning   │
│ • Tag rarity (TF-IDF)│                │ • Sliding window │
│ • Quality weighting  │                │ • Real-time      │
│ • Recency decay      │                │   adaptation     │
│ • Genre specialization                 │                  │
└──────────────────────┘                └──────────────────┘
```

## Phase 1: Core Steam Integration

### 1.1 Steam OAuth Implementation

**New Components:**
- `SteamAuthService` - OAuth flow management
- `SteamApiService` - Steam Web API interactions
- `SteamProfileComponent` - User profile display/settings

**Steam Web API Integration:**
```typescript
interface SteamUserData {
  steamId: string;
  displayName: string;
  avatarUrl: string;
  profileUrl: string;
}

interface SteamGameData {
  appId: number;
  name: string;
  playtimeForever: number;      // Total hours played
  playtime2Weeks?: number;      // Recent activity
  lastPlayed?: number;          // Unix timestamp
  hasAchievements?: boolean;
}
```

**Required API Endpoints:**
- `ISteamUser/GetPlayerSummaries` - User profile data
- `IPlayerService/GetOwnedGames` - Game library + hours
- `ISteamUserStats/GetPlayerAchievements` - Achievement data (optional)

### 1.2 Basic Hours-to-Preferences Algorithm

**Core Algorithm:**
```typescript
interface SteamPreferenceData {
  gameHours: Map<number, number>;        // appId -> hours
  lastPlayed: Map<number, number>;       // appId -> timestamp
  totalHours: number;
  gameCount: number;
}

class SteamPreferenceService {
  generateInitialPreferences(
    steamData: SteamPreferenceData,
    gameRecords: GameRecord[],
    tagDict: TagDictionary
  ): Float32Array {
    const weights = new Float32Array(tagDict.size);
    
    for (const game of gameRecords) {
      const hours = steamData.gameHours.get(game.appId) || 0;
      if (hours < 0.5) continue; // Skip games with minimal play
      
      // Logarithmic scaling to handle outliers
      const preferenceStrength = Math.log(hours + 1);
      
      // Apply to each tag in the game
      for (const [tag, votes] of Object.entries(game.tags)) {
        const tagIndex = tagDict.tagToIndex[tag];
        if (tagIndex === undefined) continue;
        
        // Normalize tag weight by vote count
        const normalizedTagWeight = votes / Math.max(votes, 100);
        
        // Accumulate preference for this tag
        weights[tagIndex] += preferenceStrength * normalizedTagWeight;
      }
    }
    
    return weights;
  }
}
```

### 1.3 Simple Blending System

**Initial Implementation (70% Steam / 30% votes):**
```typescript
interface BlendingConfig {
  steamWeight: number;    // 0.7 initially
  voteWeight: number;     // 0.3 initially
  minVotesForTransition: number; // 10 votes before reducing Steam weight
}

calculateFinalScore(game: GameRecord): number {
  const steamScore = this.calculateSteamScore(game);
  const voteScore = this.calculateVoteScore(game);
  
  return this.config.steamWeight * steamScore + 
         this.config.voteWeight * voteScore;
}
```

## Phase 2: Advanced Preference Modeling

### 2.1 Tag Rarity Weighting (TF-IDF Style)

**Implementation:**
```typescript
interface TagRarityData {
  tagFrequency: Map<string, number>;     // How many games have this tag
  inverseFrequency: Map<string, number>; // log(totalGames / gamesWithTag)
}

calculateTagRarity(games: GameRecord[]): TagRarityData {
  const tagFreq = new Map<string, number>();
  
  // Count games per tag
  games.forEach(game => {
    Object.keys(game.tags).forEach(tag => {
      tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
    });
  });
  
  // Calculate inverse frequency
  const inverseFreq = new Map<string, number>();
  tagFreq.forEach((count, tag) => {
    inverseFreq.set(tag, Math.log(games.length / count));
  });
  
  return { tagFrequency: tagFreq, inverseFrequency: inverseFreq };
}

// Enhanced preference calculation
const tagRarity = this.tagRarityData.inverseFrequency.get(tag) || 1;
const rarityAdjustedContribution = preferenceStrength * normalizedTagWeight * tagRarity;
```

### 2.2 Time-Based Decay System

**Recency Weighting:**
```typescript
interface TemporalConfig {
  halfLifeMonths: number;  // 12 months = half strength
  minimumWeight: number;   // 0.1 = never go below 10%
}

calculateRecencyFactor(lastPlayedTimestamp: number): number {
  const now = Date.now();
  const monthsAgo = (now - lastPlayedTimestamp) / (1000 * 60 * 60 * 24 * 30);
  
  // Exponential decay with configurable half-life
  const decayFactor = Math.exp(-monthsAgo * Math.log(2) / this.config.halfLifeMonths);
  
  return Math.max(this.config.minimumWeight, decayFactor);
}

// Apply to preference calculation
const recencyFactor = this.calculateRecencyFactor(steamData.lastPlayed.get(game.appId));
const timeAdjustedStrength = preferenceStrength * recencyFactor;
```

### 2.3 Quality-Adjusted Preferences

**Review Score Integration:**
```typescript
calculateQualityMultiplier(game: GameRecord): number {
  if (!game.reviewPos || !game.reviewNeg) return 1.0;
  
  const totalReviews = game.reviewPos + game.reviewNeg;
  if (totalReviews < 50) return 1.0; // Insufficient data
  
  const reviewScore = (game.reviewPos / totalReviews) * 100;
  
  // Quality multiplier: 0.1x for <30% positive, 1.5x for >90% positive
  return Math.max(0.1, Math.min(1.5, (reviewScore - 30) / 60 + 0.1));
}

// Apply quality adjustment
const qualityMultiplier = this.calculateQualityMultiplier(game);
const qualityAdjustedStrength = preferenceStrength * qualityMultiplier;
```

## Phase 3: Sophisticated Blending System

### 3.1 Confidence-Based Dynamic Blending

**Adaptive Weight Calculation:**
```typescript
interface BlendingState {
  voteCount: number;
  voteConfidence: number;        // From existing PreferenceService
  steamValidationScore: number;  // How well Steam preferences predict votes
  consistencyScore: number;      // How consistent recent votes are
}

calculateDynamicWeights(state: BlendingState): { steamWeight: number; voteWeight: number } {
  // Start Steam-heavy, transition based on vote confidence
  const baseTransition = Math.min(state.voteCount / 20, 1.0); // 20 votes for full transition
  
  // Boost vote weight if high confidence
  const confidenceBoost = state.voteConfidence * 0.3;
  
  // Reduce Steam weight if poor validation
  const validationPenalty = (1 - state.steamValidationScore) * 0.2;
  
  let voteWeight = Math.min(0.8, baseTransition + confidenceBoost - validationPenalty);
  let steamWeight = 1 - voteWeight;
  
  // Always maintain minimum Steam baseline (prevent complete override)
  steamWeight = Math.max(0.2, steamWeight);
  voteWeight = 1 - steamWeight;
  
  return { steamWeight, voteWeight };
}
```

### 3.2 Preference Validation & Trust

**Steam vs Vote Alignment Tracking:**
```typescript
interface ValidationMetrics {
  predictions: Array<{
    gameA: GameRecord;
    gameB: GameRecord;
    steamPrediction: 'A' | 'B';
    userChoice: 'A' | 'B';
    confidence: number;
  }>;
  
  alignmentScore: number;  // % of predictions that matched user choices
  trustScore: number;      // Weighted by prediction confidence
}

validateSteamPreferences(choice: UserChoice): void {
  const steamScoreA = this.calculateSteamScore(choice.gameA);
  const steamScoreB = this.calculateSteamScore(choice.gameB);
  
  const steamPrediction = steamScoreA > steamScoreB ? 'A' : 'B';
  const userChoice = choice.selected;
  
  const confidence = Math.abs(steamScoreA - steamScoreB);
  
  this.validationMetrics.predictions.push({
    gameA: choice.gameA,
    gameB: choice.gameB,
    steamPrediction,
    userChoice,
    confidence
  });
  
  this.updateTrustScore();
}
```

### 3.3 Advanced Analytics Features

**Genre Specialization Detection:**
```typescript
interface GenreAnalysis {
  hoursPerGenre: Map<string, number>;
  genreEntropy: number;          // Shannon entropy of hour distribution
  dominantGenres: string[];      // Top 3 genres by hours
  specializationScore: number;   // 0 = generalist, 1 = specialist
}

calculateGenreSpecialization(steamData: SteamPreferenceData): GenreAnalysis {
  const hoursPerGenre = new Map<string, number>();
  
  // Aggregate hours by primary genre
  this.gameRecords.forEach(game => {
    const hours = steamData.gameHours.get(game.appId) || 0;
    const primaryGenre = game.genres[0] || 'Unknown';
    
    hoursPerGenre.set(primaryGenre, (hoursPerGenre.get(primaryGenre) || 0) + hours);
  });
  
  // Calculate entropy
  const totalHours = Array.from(hoursPerGenre.values()).reduce((a, b) => a + b, 0);
  let entropy = 0;
  
  hoursPerGenre.forEach(hours => {
    const probability = hours / totalHours;
    entropy -= probability * Math.log2(probability);
  });
  
  // Specialization bonus: low entropy = high specialization
  const maxEntropy = Math.log2(hoursPerGenre.size);
  const specializationScore = 1 - (entropy / maxEntropy);
  
  return {
    hoursPerGenre,
    genreEntropy: entropy,
    dominantGenres: Array.from(hoursPerGenre.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre),
    specializationScore
  };
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Steam OAuth flow implementation
- [ ] Basic Steam Web API integration
- [ ] Hours data extraction and caching
- [ ] Simple log(hours) preference generation

### Week 3-4: Core Algorithm
- [ ] Tag rarity (TF-IDF) weighting system
- [ ] Time-based recency decay
- [ ] Quality-adjusted preference strength
- [ ] Basic 70/30 blending implementation

### Week 5-6: Advanced Features
- [ ] Confidence-based dynamic blending
- [ ] Steam preference validation system
- [ ] Genre specialization detection
- [ ] Trust score calculation and UI

### Week 7-8: Polish & Integration
- [ ] Steam profile UI components
- [ ] Settings for Steam integration toggle
- [ ] Performance optimization
- [ ] Comprehensive testing

## Technical Architecture

### New Services

```typescript
// Core Steam integration
SteamAuthService         // OAuth flow, token management
SteamApiService         // Web API calls, data fetching
SteamCacheService       // IndexedDB caching of Steam data

// Advanced preference modeling
SteamPreferenceService  // Hours-to-preferences algorithm
TagRarityService        // TF-IDF calculations
TemporalAnalysisService // Recency and decay calculations
QualityAnalysisService  // Review score processing

// Blending system
HybridScoringService    // Steam + vote score combination
ValidationService       // Steam vs vote alignment tracking
SpecializationService   // Genre analysis and specialization detection
```

### Enhanced Existing Services

```typescript
// PreferenceService extensions
interface EnhancedPreferenceService {
  // Existing methods...
  
  // New methods for Steam integration
  loadSteamPreferences(steamData: SteamPreferenceData): void;
  blendPreferences(steamWeight: number, voteWeight: number): void;
  validateSteamAlignment(choice: UserChoice): void;
  getDynamicBlendingWeights(): { steamWeight: number; voteWeight: number };
}

// VectorService extensions
interface EnhancedVectorService {
  // Existing methods...
  
  // New methods for advanced weighting
  calculateTagRarity(games: GameRecord[]): TagRarityData;
  applyQualityWeighting(vector: SparseVector, quality: number): SparseVector;
  applyTemporalDecay(vector: SparseVector, recencyFactor: number): SparseVector;
}
```

### Data Models

```typescript
interface SteamIntegrationState {
  isAuthenticated: boolean;
  userId: string;
  preferences: SteamPreferenceData;
  validationMetrics: ValidationMetrics;
  blendingConfig: BlendingConfig;
  lastSync: number;
}

interface UserPreferenceState {
  // Existing fields...
  
  // New Steam integration fields
  steamIntegration?: SteamIntegrationState;
  steamPreferences?: Float32Array;
  blendingWeights?: { steamWeight: number; voteWeight: number };
  genreAnalysis?: GenreAnalysis;
}
```

## Security & Privacy Considerations

### Data Protection
- **Minimal Data Storage**: Only store appIds, hours, and last played dates
- **Local Storage**: All Steam data cached in IndexedDB, never sent to backend
- **Token Security**: Steam OAuth tokens stored securely, auto-refresh implemented
- **User Control**: Easy opt-out and data deletion options

### API Rate Limiting
- **Steam API Limits**: 100,000 calls/day per API key
- **Caching Strategy**: 24-hour cache for game library, 1-week cache for detailed data
- **Graceful Degradation**: System works without Steam data if API unavailable

### Privacy Features
- **Profile Visibility**: Respect Steam profile privacy settings
- **Anonymous Mode**: Option to disable Steam integration completely
- **Data Transparency**: Clear UI showing what data is used and how

## Success Metrics

### User Experience Metrics
- **Cold Start Improvement**: Recommendation quality for users with <5 votes
- **Preference Accuracy**: Steam vs vote alignment scores
- **Engagement**: Time spent in recommendation phase
- **Discovery Quality**: % of recommended games added to wishlist/purchased

### Technical Metrics
- **Performance**: Additional load time from Steam integration
- **Reliability**: Success rate of Steam API calls
- **Cache Hit Rate**: Effectiveness of data caching strategy
- **Error Handling**: Graceful degradation when Steam unavailable

### Business Metrics
- **Conversion Rate**: Anonymous → Steam authenticated users
- **Retention**: Users returning after Steam integration
- **Satisfaction**: User ratings of recommendation quality
- **Adoption**: % of users who enable Steam integration

## Future Enhancements

### Advanced Features
- **Friend Integration**: Consider games popular among Steam friends
- **Wishlist Analysis**: Factor in wishlisted games for preference inference
- **Achievement Patterns**: Use achievement data for preference insights
- **Community Integration**: Steam reviews and curator follows
- **Playtime Predictions**: Predict likely hours for unplayed games

### ML Improvements
- **Multi-Armed Bandit**: A/B testing for blending ratios
- **Deep Learning**: Neural network for complex preference relationships
- **Collaborative Filtering**: User-based recommendations via similar Steam profiles
- **Temporal Modeling**: Advanced time-series analysis of preference evolution

### Social Features
- **Steam Groups**: Integration with Steam group memberships
- **Profile Sharing**: Share recommendation profiles with friends
- **Leaderboards**: Most accurate preference predictors
- **Social Validation**: Friends can validate your inferred preferences

This comprehensive plan creates the foundation for the most sophisticated game recommendation system available, combining the richness of actual play behavior with the precision of stated preferences through voting.