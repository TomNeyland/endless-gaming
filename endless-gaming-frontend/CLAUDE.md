# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the frontend for Endless Gaming, a MaxDiff-style game discovery platform built with Angular 20.1.0. The application implements client-side machine learning to learn user preferences through pairwise game comparisons and provides personalized recommendations.

## Key Development Commands

**All commands must be run from the `endless-gaming-frontend/` directory.**

### Development Server
```bash
npm start                    # Start dev server at http://localhost:4200
npm run watch               # Build in watch mode
```

### Testing
```bash
npm test                    # Run all unit tests with Karma/Jasmine
npm test -- --watch        # Run tests in watch mode
npm test -- --code-coverage # Run with coverage report
```

### Build
```bash
npm run build               # Production build (outputs to dist/)
npm run build -- --configuration development  # Development build
```

## Architecture Overview

### Core Application Flow
1. **Data Loading**: Fetch master game data from backend `/discovery/games/master.json`
2. **ML Initialization**: Build tag dictionary and initialize preference vectors
3. **Pairwise Comparison**: Show game pairs, collect user preferences via logistic SGD
4. **Real-time Feedback**: Display learned preferences as user makes choices
5. **Recommendations**: Generate ranked top 100 games based on preference model

### Service Architecture

**Data Layer**:
- `GameDataService` - IndexedDB caching of master game data with 24h TTL
- `VectorService` - Tag normalization and sparse vector operations
- `ChoiceApiService` - Offline-first analytics queue with POST to `/choices`

**ML Layer**:
- `PreferenceService` - Logistic SGD implementation with weight vector management
- `PairService` - Uncertainty sampling algorithm for optimal game pair selection

**Component Hierarchy**:
```
GamePickerPageComponent (state machine)
├── GameComparisonComponent (pairwise choice UI)
├── ProgressBarComponent (20 comparisons progress)
├── PreferenceSummaryComponent (live tag preferences)
└── RecommendationListComponent (ranked game list)
```

### Key Technical Patterns

**Angular Signals**: All reactive state uses Angular Signals for performance
```typescript
public readonly state = signal<GamePickerState>('loading');
private preferenceSummary$ = new BehaviorSubject<PreferenceSummary>(...);
```

**Dependency Injection**: Modern `inject()` function pattern
```typescript
private gameDataService = inject(GameDataService);
private vectorService = inject(VectorService);
```

**Standalone Components**: No NgModules, direct component imports
```typescript
@Component({
  standalone: true,
  imports: [CommonModule, GameComparisonComponent, ...]
})
```

**TypeScript Strict Mode**: Comprehensive type safety enabled
- `strict: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

### Core Libraries

**Production Dependencies**:
- `dexie: ^4.0.11` - IndexedDB wrapper for offline caching
- `fastpriorityqueue: ^0.7.5` - Efficient top-K game ranking
- `vectorious: ^6.1.14` - Typed-array math operations for ML

**Testing Stack**:
- `jasmine-core: ~5.8.0` + `karma: ~6.4.0` for unit testing
- `puppeteer: ^24.14.0` for headless browser testing
- Custom Karma config with `ChromeHeadlessNoSandbox` for CI/Docker

## Data Types and Interfaces

### Core Game Data
```typescript
interface GameRecord {
  appId: number;
  name: string;
  coverUrl: string | null;
  price: string | null;  // "Free" or dollar amount
  tags: { [tag: string]: number };  // Tag votes
  genres: string[];
  reviewPos: number | null;
  reviewNeg: number | null;
}
```

### ML Types
```typescript
interface SparseVector {
  indices: Uint16Array;  // Tag indices
  values: Float32Array;  // Normalized values
  size: number;          // Vector dimension
}

interface TagDictionary {
  tagToIndex: { [tag: string]: number };
  indexToTag: string[];
  size: number;
}
```

## Testing Philosophy

### Test Structure
- Component tests focus on user interactions and state transitions
- Service tests emphasize core algorithms and data transformations
- Integration tests validate IndexedDB operations and HTTP calls

### ML Algorithm Testing
- `VectorService`: Tag normalization, sparse vector conversions, dot products
- `PreferenceService`: SGD updates, preference summaries, game ranking
- `PairService`: Uncertainty sampling algorithm validation

### Mock Patterns
```typescript
// HttpClient mocking for GameDataService
const mockHttp = jasmine.createSpyObj('HttpClient', ['get']);
mockHttp.get.and.returnValue(of(mockGames));

// IndexedDB mocking with in-memory fallback
beforeEach(() => {
  spyOn(console, 'warn'); // Suppress IndexedDB warnings in tests
});
```

## State Management

### Application States
- `loading` - Fetching master data from backend
- `comparing` - Pairwise comparison phase (20 comparisons)
- `recommendations` - Showing ranked game list
- `error` - Error state with fallback UI

### Persistence Strategy
- **IndexedDB**: Game data cache, user preference state, offline choice queue
- **Memory**: Active weight vectors, tag dictionaries, current game pairs
- **Session**: Progress through comparison flow, current recommendations

## Performance Considerations

### Bundle Size Optimization
- Lazy-loaded routes for each feature
- Tree-shaking enabled for all external libraries
- Angular build budgets: 500kB warning, 1MB error for initial bundle

### ML Performance
- Sparse vectors for memory efficiency with 1000+ games
- Float32Array for vectorious math operations
- Priority queue maintains only top-100 recommendations

### Caching Strategy
- 24-hour TTL for master game data
- In-memory caching of processed vectors and tag dictionaries
- Offline-first choice logging with background sync

## Error Handling

### Network Resilience
- Automatic fallback to cached data when backend unavailable
- Graceful IndexedDB failure handling for test environments
- Retry logic for choice analytics API calls

### ML Error Recovery
- Validates tag dictionary before vector operations
- Handles missing/malformed game data gracefully
- Fallback scoring when preference model uninitialized

## Development Workflow

### Component Development
1. Create failing tests for component behavior
2. Implement component with proper typing and signal usage
3. Add integration tests for service interactions
4. Verify accessibility and responsive design

### Service Development
1. Write tests for core algorithms (happy path + edge cases)
2. Implement with proper dependency injection
3. Add error handling and graceful degradation
4. Test persistence/caching behavior

### Testing Best Practices
- Use `ng test` for continuous testing during development
- Mock external dependencies (HTTP, IndexedDB) consistently
- Focus on testing user-facing behavior over implementation details
- Validate ML algorithms with known input/output pairs