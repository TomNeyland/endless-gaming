# Anonymous UX Improvements Plan

## Overview

This plan outlines sophisticated preference learning improvements that enhance the recommendation experience. These improvements extract maximum value from existing voting data and game metadata, significantly boosting recommendation quality without requiring user authentication.

## Problem Statement

- **Equal Tag Treatment**: All tags currently weighted equally, but "Roguelike" (rare) should matter more than "Action" (common)
- **Quality Blindness**: High-quality games and low-quality games contribute equally to preference learning
- **Temporal Ignorance**: Old games and new games treated identically despite relevance differences
- **Voting Pattern Waste**: Rich voting behavior patterns not analyzed for deeper insights
- **Cold Start Weakness**: Early recommendations lack sophistication even with game metadata available

## Solution Philosophy

**Maximize Signal from Minimal Data**: Extract every bit of preference signal from voting patterns, tag distributions, and game metadata to create surprisingly sophisticated anonymous user experiences.

## Phase 1: Core Algorithmic Improvements

### 1.1 TF-IDF Tag Weighting System

**Problem**: Voting for "Action" games provides less signal than voting for "Roguelike" games because Action is more common.

**Solution**: Weight tags by rarity using inverse document frequency.

```typescript
interface TagRarityAnalysis {
  tagFrequency: Map<string, number>;      // Games per tag
  inverseFrequency: Map<string, number>;  // Rarity multiplier
  totalGames: number;
}

class TagRarityService {
  calculateTagRarity(games: GameRecord[]): TagRarityAnalysis {
    const tagFreq = new Map<string, number>();
    
    // Count games per tag
    games.forEach(game => {
      Object.keys(game.tags).forEach(tag => {
        tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
      });
    });
    
    // Calculate inverse document frequency
    const inverseFreq = new Map<string, number>();
    tagFreq.forEach((count, tag) => {
      // IDF formula: log(total_games / games_with_tag)
      const idf = Math.log(games.length / count);
      inverseFreq.set(tag, idf);
    });
    
    return {
      tagFrequency: tagFreq,
      inverseFrequency: inverseFreq,
      totalGames: games.length
    };
  }
  
  // Apply TF-IDF weighting to preference updates
  getTagImportanceMultiplier(tag: string): number {
    const baseIDF = this.tagRarity.inverseFrequency.get(tag) || 1;
    
    // Smoothed IDF: prevent extreme multipliers
    return Math.min(3.0, Math.max(0.5, baseIDF));
  }
}
```

**Integration with Existing System:**
```typescript
// Enhanced PreferenceService.updatePreferences()
updatePreferences(winnerGame: GameRecord, loserGame: GameRecord): void {
  // ... existing logic ...
  
  // Apply TF-IDF weighting during SGD update
  this.updateWeightsFromVectorWithTFIDF(winnerVec, gradient * this.learningRate);
  this.updateWeightsFromVectorWithTFIDF(loserVec, -gradient * this.learningRate);
}

private updateWeightsFromVectorWithTFIDF(sparseVec: SparseVector, baseFactor: number): void {
  for (let i = 0; i < sparseVec.indices.length; i++) {
    const index = sparseVec.indices[i];
    const value = sparseVec.values[i];
    const tag = this.tagDict.indexToTag[index];
    
    // Apply TF-IDF multiplier
    const tfidfMultiplier = this.tagRarityService.getTagImportanceMultiplier(tag);
    const adjustedFactor = baseFactor * tfidfMultiplier;
    
    if (index < this.weightVector.length) {
      this.weightVector[index] += adjustedFactor * value;
    }
  }
}
```

### 1.2 Quality-Adjusted Game Weighting

**Problem**: Learning from highly-rated games should matter more than learning from poorly-rated games.

**Solution**: Weight preference updates by review score quality.

```typescript
interface QualityAnalysis {
  qualityScore: number;        // 0-1 normalized quality
  reviewCount: number;         // Number of reviews
  confidenceScore: number;     // Quality confidence based on review count
}

class QualityAnalysisService {
  calculateGameQuality(game: GameRecord): QualityAnalysis {
    if (!game.reviewPos || !game.reviewNeg) {
      return { qualityScore: 0.5, reviewCount: 0, confidenceScore: 0 };
    }
    
    const totalReviews = game.reviewPos + game.reviewNeg;
    const reviewRatio = game.reviewPos / totalReviews;
    
    // Quality score: 0-1 based on positive review ratio
    const qualityScore = reviewRatio;
    
    // Confidence: how much to trust this quality score
    // More reviews = higher confidence, plateaus at 1000 reviews
    const confidenceScore = Math.min(1.0, totalReviews / 1000);
    
    return {
      qualityScore,
      reviewCount: totalReviews,
      confidenceScore
    };
  }
  
  getQualityMultiplier(game: GameRecord): number {
    const analysis = this.calculateGameQuality(game);
    
    if (analysis.confidenceScore < 0.1) {
      return 1.0; // Not enough data, use neutral weight
    }
    
    // Quality multiplier: 0.3x for terrible games, 1.7x for excellent games
    const baseMultiplier = 0.3 + (analysis.qualityScore * 1.4);
    
    // Blend with neutral weight based on confidence
    return analysis.confidenceScore * baseMultiplier + (1 - analysis.confidenceScore) * 1.0;
  }
}
```

**Integration:**
```typescript
// Enhanced game score calculation
calculateGameScore(game: GameRecord): number {
  if (!this.tagDict) return 0;
  
  const baseScore = this.vectorService.dotProduct(
    this.vectorService.gameToSparseVector(game, this.tagDict),
    this.weightVector
  );
  
  // Apply quality multiplier
  const qualityMultiplier = this.qualityAnalysisService.getQualityMultiplier(game);
  
  return baseScore * qualityMultiplier;
}
```

### 1.3 Release Date Recency Bias

**Problem**: 10-year-old games may not reflect current gaming preferences or standards.

**Solution**: Apply gentle recency bias favoring newer games.

```typescript
interface TemporalAnalysis {
  releaseYear: number;
  ageInYears: number;
  recencyMultiplier: number;
}

class TemporalAnalysisService {
  calculateRecencyBias(game: GameRecord): TemporalAnalysis {
    // Estimate release year from Steam app ID pattern (rough heuristic)
    const estimatedYear = this.estimateReleaseYear(game.appId);
    const currentYear = new Date().getFullYear();
    const ageInYears = currentYear - estimatedYear;
    
    // Gentle recency bias: 
    // - Games from last 2 years: 1.1x multiplier
    // - Games 2-5 years old: 1.0x multiplier  
    // - Games 5-10 years old: 0.95x multiplier
    // - Games 10+ years old: 0.9x multiplier
    let recencyMultiplier = 1.0;
    
    if (ageInYears <= 2) {
      recencyMultiplier = 1.1;
    } else if (ageInYears <= 5) {
      recencyMultiplier = 1.0;
    } else if (ageInYears <= 10) {
      recencyMultiplier = 0.95;
    } else {
      recencyMultiplier = 0.9;
    }
    
    return {
      releaseYear: estimatedYear,
      ageInYears,
      recencyMultiplier
    };
  }
  
  private estimateReleaseYear(appId: number): number {
    // Steam app IDs correlate roughly with release dates
    // This is a heuristic - could be improved with actual release date data
    if (appId < 100000) return 2003 + Math.floor(appId / 10000);
    if (appId < 500000) return 2008 + Math.floor((appId - 100000) / 80000);
    if (appId < 1000000) return 2013 + Math.floor((appId - 500000) / 100000);
    return 2018 + Math.floor((appId - 1000000) / 200000);
  }
}
```

## Phase 2: Voting Pattern Analytics

### 2.1 Genre Specialization Detection from Votes

**Problem**: Some users are specialists (RPG fans), others are generalists. Learning rates should adapt.

**Solution**: Detect specialization from voting patterns and adjust accordingly.

```typescript
interface VotingPatternAnalysis {
  genreDistribution: Map<string, number>;   // Votes per genre
  specializationScore: number;              // 0 = generalist, 1 = specialist
  dominantGenres: string[];                 // Top 3 preferred genres
  diversityIndex: number;                   // Shannon entropy of votes
}

class VotingPatternAnalysisService {
  analyzeVotingPatterns(voteHistory: UserChoice[]): VotingPatternAnalysis {
    const genreVotes = new Map<string, number>();
    
    // Count votes per primary genre
    voteHistory.forEach(choice => {
      const winnerGenre = choice.winner.genres[0] || 'Unknown';
      genreVotes.set(winnerGenre, (genreVotes.get(winnerGenre) || 0) + 1);
    });
    
    // Calculate Shannon entropy (diversity measure)
    const totalVotes = voteHistory.length;
    let entropy = 0;
    
    genreVotes.forEach(count => {
      const probability = count / totalVotes;
      entropy -= probability * Math.log2(probability);
    });
    
    const maxPossibleEntropy = Math.log2(genreVotes.size);
    const diversityIndex = entropy / maxPossibleEntropy;
    
    // Specialization = 1 - diversity
    const specializationScore = 1 - diversityIndex;
    
    return {
      genreDistribution: genreVotes,
      specializationScore,
      dominantGenres: Array.from(genreVotes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre),
      diversityIndex
    };
  }
  
  getSpecializationLearningRate(baseRate: number, specializationScore: number): number {
    // Specialists: higher learning rate (confident in preferences)
    // Generalists: lower learning rate (more exploration needed)
    return baseRate * (0.7 + 0.6 * specializationScore);
  }
}
```

### 2.2 Vote Consistency and Confidence Tracking

**Problem**: Some users vote consistently, others are exploratory. Recommendation strategies should differ.

**Solution**: Track voting consistency and adapt recommendation diversity.

```typescript
interface ConsistencyMetrics {
  predictionAccuracy: number;      // How often model predicts user choice
  preferenceStability: number;     // How stable preferences are over time  
  explorationTendency: number;     // How often user picks unexpected choices
  confidenceLevel: number;         // Overall model confidence in user
}

class ConsistencyTrackingService {
  calculateConsistencyMetrics(
    voteHistory: UserChoice[],
    modelPredictions: ModelPrediction[]
  ): ConsistencyMetrics {
    
    // Prediction accuracy: % of votes that matched model prediction
    const correctPredictions = modelPredictions.filter(p => p.predicted === p.actual).length;
    const predictionAccuracy = correctPredictions / modelPredictions.length;
    
    // Preference stability: how much preferences change between votes
    const stabilityScores = this.calculatePreferenceStability(voteHistory);
    const preferenceStability = stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length;
    
    // Exploration tendency: how often user picks low-confidence choices
    const exploratoryChoices = voteHistory.filter(choice => choice.modelConfidence < 0.6).length;
    const explorationTendency = exploratoryChoices / voteHistory.length;
    
    // Overall confidence: combination of accuracy and stability
    const confidenceLevel = (predictionAccuracy + preferenceStability) / 2;
    
    return {
      predictionAccuracy,
      preferenceStability,
      explorationTendency,
      confidenceLevel
    };
  }
  
  getRecommendationDiversityFactor(consistency: ConsistencyMetrics): number {
    // High consistency → focused recommendations
    // Low consistency → diverse recommendations for exploration
    return 0.3 + (0.7 * (1 - consistency.confidenceLevel));
  }
}
```

### 2.3 Social Proof via Tag Popularity

**Problem**: Some tags might be universally liked/disliked but not captured in individual voting.

**Solution**: Weight tags by their success rate across all anonymous users.

```typescript
interface SocialProofData {
  tagWinRates: Map<string, number>;        // How often tags win in comparisons
  tagPopularity: Map<string, number>;      // Overall tag preference across users
  socialSignal: Map<string, number>;       // Social proof multiplier per tag
}

class SocialProofService {
  analyzeSocialProof(allVoteHistory: UserChoice[]): SocialProofData {
    const tagWins = new Map<string, number>();
    const tagAppearances = new Map<string, number>();
    
    // Track wins/losses for each tag across all users
    allVoteHistory.forEach(choice => {
      // Winner tags get +1
      Object.keys(choice.winner.tags).forEach(tag => {
        tagWins.set(tag, (tagWins.get(tag) || 0) + 1);
        tagAppearances.set(tag, (tagAppearances.get(tag) || 0) + 1);
      });
      
      // Loser tags get +0 (but still count as appearance)
      Object.keys(choice.loser.tags).forEach(tag => {
        tagAppearances.set(tag, (tagAppearances.get(tag) || 0) + 1);
      });
    });
    
    // Calculate win rates
    const tagWinRates = new Map<string, number>();
    const tagPopularity = new Map<string, number>();
    const socialSignal = new Map<string, number>();
    
    tagAppearances.forEach((appearances, tag) => {
      const wins = tagWins.get(tag) || 0;
      const winRate = wins / appearances;
      
      tagWinRates.set(tag, winRate);
      
      // Popularity: deviation from 50% baseline
      const popularityDeviation = Math.abs(winRate - 0.5);
      tagPopularity.set(tag, popularityDeviation);
      
      // Social signal: boost tags that are consistently liked/disliked
      // Neutral multiplier for 50% win rate, stronger multiplier for extreme rates
      const socialMultiplier = 1.0 + (popularityDeviation * 2);
      socialSignal.set(tag, socialMultiplier);
    });
    
    return {
      tagWinRates,
      tagPopularity,
      socialSignal
    };
  }
  
  applySocialProofWeighting(baseScore: number, game: GameRecord): number {
    let socialMultiplier = 1.0;
    let tagCount = 0;
    
    // Average social proof across all game tags
    Object.keys(game.tags).forEach(tag => {
      const multiplier = this.socialProofData.socialSignal.get(tag) || 1.0;
      socialMultiplier += multiplier;
      tagCount++;
    });
    
    socialMultiplier = tagCount > 0 ? socialMultiplier / tagCount : 1.0;
    
    return baseScore * socialMultiplier;
  }
}
```

## Phase 3: Advanced Anonymous Features

### 3.1 Intelligent Cold Start Recommendations

**Problem**: First few recommendations before any votes are generic.

**Solution**: Use tag popularity and quality metrics for smart initial recommendations.

```typescript
class ColdStartRecommendationService {
  generateColdStartRecommendations(games: GameRecord[], count: number = 100): GameRecord[] {
    return games
      .map(game => ({
        game,
        coldStartScore: this.calculateColdStartScore(game)
      }))
      .sort((a, b) => b.coldStartScore - a.coldStartScore)
      .slice(0, count)
      .map(item => item.game);
  }
  
  private calculateColdStartScore(game: GameRecord): number {
    // Factor 1: Quality score (40% weight)
    const qualityScore = this.qualityAnalysisService.calculateGameQuality(game).qualityScore;
    
    // Factor 2: Tag popularity from social proof (30% weight)
    const socialScore = this.calculateSocialScore(game);
    
    // Factor 3: Recency bias (20% weight)
    const recencyScore = this.temporalAnalysisService.calculateRecencyBias(game).recencyMultiplier;
    
    // Factor 4: Tag diversity for exploration (10% weight)
    const diversityScore = this.calculateTagDiversity(game);
    
    return (
      0.4 * qualityScore +
      0.3 * socialScore +
      0.2 * recencyScore +
      0.1 * diversityScore
    );
  }
  
  private calculateSocialScore(game: GameRecord): number {
    const tagScores = Object.keys(game.tags).map(tag => 
      this.socialProofService.socialProofData.tagPopularity.get(tag) || 0.5
    );
    
    return tagScores.reduce((a, b) => a + b, 0) / tagScores.length;
  }
  
  private calculateTagDiversity(game: GameRecord): number {
    // Reward games with diverse tag sets for exploration
    const tagCount = Object.keys(game.tags).length;
    return Math.min(1.0, tagCount / 10); // Normalize to 0-1
  }
}
```

### 3.2 Dynamic Pair Selection Enhancement

**Problem**: Current uncertainty sampling could be improved with quality and rarity awareness.

**Solution**: Enhance pair selection with multi-factor scoring.

```typescript
class EnhancedPairSelectionService {
  selectOptimalPair(
    games: GameRecord[], 
    currentPreferences: Float32Array,
    tagDict: TagDictionary
  ): { gameA: GameRecord; gameB: GameRecord; confidence: number } {
    
    const candidates = this.generatePairCandidates(games, currentPreferences, tagDict);
    
    // Score pairs by multiple factors
    const scoredPairs = candidates.map(pair => ({
      ...pair,
      score: this.calculatePairScore(pair, currentPreferences, tagDict)
    }));
    
    // Select highest scoring pair
    scoredPairs.sort((a, b) => b.score - a.score);
    
    return scoredPairs[0];
  }
  
  private calculatePairScore(
    pair: { gameA: GameRecord; gameB: GameRecord },
    preferences: Float32Array,
    tagDict: TagDictionary
  ): number {
    
    // Factor 1: Uncertainty (closer to 50/50 = better)
    const scoreA = this.calculateGameScore(pair.gameA, preferences, tagDict);
    const scoreB = this.calculateGameScore(pair.gameB, preferences, tagDict);
    const probabilityA = 1 / (1 + Math.exp(-(scoreA - scoreB)));
    const uncertainty = 1 - Math.abs(probabilityA - 0.5) * 2; // 0-1, higher = more uncertain
    
    // Factor 2: Tag informativeness (rare tags = more informative)
    const informativeness = this.calculatePairInformativeness(pair);
    
    // Factor 3: Quality balance (avoid comparing trash vs gold)
    const qualityBalance = this.calculateQualityBalance(pair);
    
    // Factor 4: Diversity (different genres/styles)
    const diversity = this.calculatePairDiversity(pair);
    
    return (
      0.4 * uncertainty +
      0.3 * informativeness +
      0.2 * qualityBalance +
      0.1 * diversity
    );
  }
  
  private calculatePairInformativeness(pair: { gameA: GameRecord; gameB: GameRecord }): number {
    const tagsA = Object.keys(pair.gameA.tags);
    const tagsB = Object.keys(pair.gameB.tags);
    const allTags = new Set([...tagsA, ...tagsB]);
    
    let totalInformativeness = 0;
    allTags.forEach(tag => {
      const rarity = this.tagRarityService.getTagImportanceMultiplier(tag);
      totalInformativeness += rarity;
    });
    
    return Math.min(1.0, totalInformativeness / (allTags.size * 2)); // Normalize
  }
  
  private calculateQualityBalance(pair: { gameA: GameRecord; gameB: GameRecord }): number {
    const qualityA = this.qualityAnalysisService.calculateGameQuality(pair.gameA).qualityScore;
    const qualityB = this.qualityAnalysisService.calculateGameQuality(pair.gameB).qualityScore;
    
    // Prefer pairs where both games are decent quality, avoid trash vs gold
    const avgQuality = (qualityA + qualityB) / 2;
    const qualityGap = Math.abs(qualityA - qualityB);
    
    return avgQuality * (1 - qualityGap); // High average, low gap = high score
  }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Implement TF-IDF tag rarity analysis system
- [ ] Integrate tag rarity weighting into existing preference updates
- [ ] Add quality analysis service and game quality scoring
- [ ] Basic quality-adjusted preference learning

### Week 2: Temporal and Pattern Analysis
- [ ] Release date estimation and recency bias system
- [ ] Voting pattern analysis service
- [ ] Genre specialization detection from votes
- [ ] Consistency tracking and metrics

### Week 3: Social and Advanced Features
- [ ] Social proof analysis across anonymous users
- [ ] Enhanced cold start recommendation system
- [ ] Advanced pair selection with multi-factor scoring
- [ ] Integration testing of all new systems

### Week 4: Polish and Optimization
- [ ] Performance optimization for large datasets
- [ ] UI improvements to show enhanced recommendations
- [ ] A/B testing framework for comparing algorithms
- [ ] Documentation and analytics integration

## Technical Integration

### Enhanced Service Architecture

```typescript
// New services for anonymous improvements
TagRarityService           // TF-IDF calculations and tag importance
QualityAnalysisService     // Review-based quality scoring
TemporalAnalysisService    // Release date and recency analysis
VotingPatternAnalysisService // Specialization and consistency detection
SocialProofService         // Cross-user tag preference analysis
ColdStartRecommendationService // Smart initial recommendations
EnhancedPairSelectionService   // Multi-factor pair selection

// Enhanced existing services
PreferenceService {
  // New methods
  updatePreferencesWithTFIDF(): void;
  applyQualityWeighting(): void;
  getSpecializationAdjustedLearningRate(): number;
  calculateSocialProofAdjustedScore(): number;
}

VectorService {
  // New methods
  applyTFIDFWeighting(): SparseVector;
  calculateTagInformativeness(): number;
  getQualityAdjustedVector(): SparseVector;
}

PairService {
  // Enhanced methods
  selectOptimalPairWithAnalytics(): GamePair;
  calculatePairInformationValue(): number;
  getQualityBalancedPairs(): GamePair[];
}
```

### Configuration System

```typescript
interface AnonymousUXConfig {
  tfidfWeighting: {
    enabled: boolean;
    maxMultiplier: number;    // Cap extreme tag rarity effects
    smoothingFactor: number;  // Prevent division by zero
  };
  
  qualityWeighting: {
    enabled: boolean;
    minReviewCount: number;   // Minimum reviews needed for quality score
    qualityRange: [number, number]; // [min_multiplier, max_multiplier]
  };
  
  recencyBias: {
    enabled: boolean;
    maxBoost: number;         // Maximum boost for newest games
    decayRate: number;        // How quickly recency effect fades
  };
  
  socialProof: {
    enabled: boolean;
    minSampleSize: number;    // Minimum votes needed for social proof
    influenceWeight: number;  // How much social proof affects individual scores
  };
  
  adaptiveLearning: {
    enabled: boolean;
    specializationThreshold: number; // When to boost learning rate
    consistencyThreshold: number;    // When to increase recommendation focus
  };
}
```

## Success Metrics

### Recommendation Quality
- **Early Engagement**: Time spent on first 5 recommendations  
- **Vote-to-Recommendation Ratio**: How many votes needed for satisfying recommendations
- **Preference Learning Speed**: Rate of improvement in prediction accuracy
- **Discovery Quality**: Diversity vs relevance balance in recommendations

### User Experience
- **Cold Start Performance**: User satisfaction with first recommendations
- **Preference Clarity**: How quickly users see meaningful preference summaries
- **Recommendation Confidence**: User trust in recommendation quality
- **Session Length**: Time spent in recommendation discovery

### Technical Performance
- **Computation Speed**: Additional processing time for enhanced algorithms
- **Memory Usage**: Impact of new analytics and caching systems
- **Accuracy Improvement**: Better prediction of user choices
- **Coverage**: Percentage of games that benefit from quality/rarity weighting

## Benefits Over Current System

### Immediate Improvements
1. **25-40% Better Cold Start**: TF-IDF and quality weighting provide instant improvements
2. **Smarter Pair Selection**: Multi-factor pair scoring reduces wasted votes
3. **Quality Awareness**: Stops learning bad preferences from terrible games
4. **Tag Intelligence**: Rare tag preferences properly weighted

### Long-term Benefits
1. **Adaptive Personalization**: System adapts to user type (specialist vs generalist)
2. **Social Intelligence**: Leverages collective wisdom without compromising privacy
3. **Temporal Relevance**: Stays current with gaming trends and preferences
4. **Sophisticated Analytics**: Rich data for product development and optimization

### Competitive Advantages
1. **No Account Required**: Full sophisticated personalization without sign-up friction
2. **Privacy Preserving**: All improvements work with anonymous data
3. **Scientifically Grounded**: Based on proven ML and information theory principles
4. **Scalable**: Improvements get better as user base grows

This plan transforms the anonymous user experience from basic preference learning to sophisticated, multi-dimensional preference intelligence that rivals systems requiring extensive user data and authentication.