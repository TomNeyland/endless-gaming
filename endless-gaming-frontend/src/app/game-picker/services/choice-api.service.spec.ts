import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChoiceApiService } from './choice-api.service';
import { ChoiceEvent } from '../../types/game.types';

describe('ChoiceApiService', () => {
  let service: ChoiceApiService;
  let httpMock: HttpTestingController;

  const mockChoiceEvent: ChoiceEvent = {
    leftId: 730,
    rightId: 570,
    pick: 'left',
    ts: Date.now()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ChoiceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.stopAutoFlush();
    service.clearQueue();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('queueChoice', () => {
    it('should add choice to queue', () => {
      expect(service.getQueuedCount()).toBe(0);
      
      service.queueChoice(mockChoiceEvent);
      
      expect(service.getQueuedCount()).toBe(1);
    });

    it('should handle multiple choices', () => {
      const choices: ChoiceEvent[] = [
        { leftId: 730, rightId: 570, pick: 'left', ts: Date.now() },
        { leftId: 440, rightId: 289070, pick: 'right', ts: Date.now() },
        { leftId: 730, rightId: 440, pick: 'skip', ts: Date.now() }
      ];
      
      choices.forEach(choice => service.queueChoice(choice));
      
      expect(service.getQueuedCount()).toBe(3);
    });

    it('should queue choices when offline', () => {
      // Simulate offline state
      spyOn(service, 'isOnline').and.returnValue(false);
      
      service.queueChoice(mockChoiceEvent);
      
      expect(service.getQueuedCount()).toBe(1);
    });

    it('should accept all choice types', () => {
      const choices: ('left' | 'right' | 'skip')[] = ['left', 'right', 'skip'];
      
      choices.forEach(pick => {
        service.queueChoice({
          leftId: 730,
          rightId: 570,
          pick,
          ts: Date.now()
        });
      });
      
      expect(service.getQueuedCount()).toBe(3);
    });
  });

  describe('flushChoices', () => {
    beforeEach(() => {
      service.queueChoice(mockChoiceEvent);
    });

    it('should send queued choices to backend', () => {
      service.flushChoices().subscribe(() => {
        expect(service.getQueuedCount()).toBe(0);
      });

      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual([mockChoiceEvent]);
      req.flush({});
    });

    it('should handle multiple choices in batch', () => {
      const additionalChoices: ChoiceEvent[] = [
        { leftId: 440, rightId: 570, pick: 'right', ts: Date.now() },
        { leftId: 730, rightId: 289070, pick: 'skip', ts: Date.now() }
      ];
      
      additionalChoices.forEach(choice => service.queueChoice(choice));
      
      expect(service.getQueuedCount()).toBe(3);
      
      service.flushChoices().subscribe();

      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.body.length).toBe(3);
      req.flush({});
    });

    it('should handle HTTP errors gracefully', () => {
      service.flushChoices().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.status).toBe(500);
          // Queue should remain intact on error
          expect(service.getQueuedCount()).toBe(1);
        }
      });

      const req = httpMock.expectOne('/discovery/choices');
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle empty queue', () => {
      service.clearQueue();
      expect(service.getQueuedCount()).toBe(0);
      
      service.flushChoices().subscribe(result => {
        expect(result).toBeUndefined();
      });

      // Should not make HTTP request for empty queue
      httpMock.expectNone('/discovery/choices');
    });

    it('should include user ID in request', () => {
      const userId = service.getUserId();
      
      service.flushChoices().subscribe();

      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.headers.get('X-User-ID')).toBe(userId);
      req.flush({});
    });
  });

  describe('getQueuedCount', () => {
    it('should return zero initially', () => {
      expect(service.getQueuedCount()).toBe(0);
    });

    it('should update when choices are queued', () => {
      for (let i = 1; i <= 5; i++) {
        service.queueChoice({
          leftId: 730,
          rightId: 570,
          pick: 'left',
          ts: Date.now()
        });
        expect(service.getQueuedCount()).toBe(i);
      }
    });

    it('should update when queue is flushed', () => {
      service.queueChoice(mockChoiceEvent);
      expect(service.getQueuedCount()).toBe(1);

      service.flushChoices().subscribe();
      const req = httpMock.expectOne('/discovery/choices');
      req.flush({});

      expect(service.getQueuedCount()).toBe(0);
    });

    it('should update when queue is cleared', () => {
      service.queueChoice(mockChoiceEvent);
      service.queueChoice(mockChoiceEvent);
      expect(service.getQueuedCount()).toBe(2);

      service.clearQueue();
      expect(service.getQueuedCount()).toBe(0);
    });
  });

  describe('isOnline', () => {
    it('should return boolean value', () => {
      const online = service.isOnline();
      expect(typeof online).toBe('boolean');
    });

    it('should detect online state changes', () => {
      const initialState = service.isOnline();
      
      // Simulate network state change
      const event = new Event('online');
      window.dispatchEvent(event);
      
      // Should still return valid boolean
      expect(typeof service.isOnline()).toBe('boolean');
    });
  });

  describe('getUserId', () => {
    it('should return consistent user ID', () => {
      const userId1 = service.getUserId();
      const userId2 = service.getUserId();
      
      expect(userId1).toBe(userId2);
      expect(userId1.length).toBeGreaterThan(0);
    });

    it('should generate UUID format', () => {
      const userId = service.getUserId();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(userId)).toBe(true);
    });

    it('should persist across service instances', () => {
      const userId1 = service.getUserId();
      
      // Create new service instance
      const freshService = TestBed.inject(ChoiceApiService);
      const userId2 = freshService.getUserId();
      
      expect(userId1).toBe(userId2);
    });
  });

  describe('clearQueue', () => {
    beforeEach(() => {
      // Add some choices to queue
      for (let i = 0; i < 3; i++) {
        service.queueChoice({
          leftId: 730 + i,
          rightId: 570,
          pick: 'left',
          ts: Date.now()
        });
      }
    });

    it('should clear all queued choices', () => {
      expect(service.getQueuedCount()).toBe(3);
      
      service.clearQueue();
      
      expect(service.getQueuedCount()).toBe(0);
    });

    it('should not affect subsequent queueing', () => {
      service.clearQueue();
      expect(service.getQueuedCount()).toBe(0);
      
      service.queueChoice(mockChoiceEvent);
      expect(service.getQueuedCount()).toBe(1);
    });

    it('should handle empty queue', () => {
      service.clearQueue();
      expect(service.getQueuedCount()).toBe(0);
      
      // Clearing again should not throw
      expect(() => service.clearQueue()).not.toThrow();
      expect(service.getQueuedCount()).toBe(0);
    });
  });

  describe('auto flush functionality', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should start auto flush', () => {
      spyOn(service, 'isOnline').and.returnValue(true);
      
      service.startAutoFlush();
      service.queueChoice(mockChoiceEvent);
      
      // Fast forward time to trigger auto flush
      jasmine.clock().tick(31000); // 30 seconds + buffer
      
      // Should attempt to flush
      httpMock.expectOne('/discovery/choices').flush({});
    });

    it('should stop auto flush', () => {
      service.startAutoFlush();
      service.stopAutoFlush();
      
      service.queueChoice(mockChoiceEvent);
      
      // Fast forward time
      jasmine.clock().tick(60000); // 1 minute
      
      // Should not attempt to flush after stopping
      httpMock.expectNone('/discovery/choices');
    });

    it('should not flush when offline', () => {
      spyOn(service, 'isOnline').and.returnValue(false);
      
      service.startAutoFlush();
      service.queueChoice(mockChoiceEvent);
      
      jasmine.clock().tick(31000);
      
      // Should not flush when offline
      httpMock.expectNone('/discovery/choices');
    });

    it('should handle auto flush errors gracefully', () => {
      spyOn(service, 'isOnline').and.returnValue(true);
      
      service.startAutoFlush();
      service.queueChoice(mockChoiceEvent);
      
      jasmine.clock().tick(31000);
      
      const req = httpMock.expectOne('/discovery/choices');
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
      
      // Should continue auto flushing despite error
      expect(service.getQueuedCount()).toBe(1); // Choice should remain queued
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical usage pattern', () => {
      // Queue several choices
      const choices: ChoiceEvent[] = [
        { leftId: 730, rightId: 570, pick: 'left', ts: Date.now() },
        { leftId: 440, rightId: 289070, pick: 'right', ts: Date.now() },
        { leftId: 730, rightId: 440, pick: 'skip', ts: Date.now() }
      ];
      
      choices.forEach(choice => service.queueChoice(choice));
      expect(service.getQueuedCount()).toBe(3);
      
      // Flush choices
      service.flushChoices().subscribe(() => {
        expect(service.getQueuedCount()).toBe(0);
      });
      
      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.body).toEqual(choices);
      req.flush({});
    });

    it('should handle offline to online transition', () => {
      spyOn(service, 'isOnline').and.returnValue(false);
      
      // Queue choices while offline
      service.queueChoice(mockChoiceEvent);
      expect(service.getQueuedCount()).toBe(1);
      
      // Come back online
      (service.isOnline as jasmine.Spy).and.returnValue(true);
      
      // Manual flush should work
      service.flushChoices().subscribe();
      const req = httpMock.expectOne('/discovery/choices');
      req.flush({});
      
      expect(service.getQueuedCount()).toBe(0);
    });

    it('should maintain user session across operations', () => {
      const userId = service.getUserId();
      
      // Queue and flush choices
      service.queueChoice(mockChoiceEvent);
      service.flushChoices().subscribe();
      
      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.headers.get('X-User-ID')).toBe(userId);
      req.flush({});
      
      // User ID should remain the same
      expect(service.getUserId()).toBe(userId);
    });

    it('should handle rapid queueing and flushing', () => {
      // Rapidly queue choices
      for (let i = 0; i < 10; i++) {
        service.queueChoice({
          leftId: 730,
          rightId: 570 + i,
          pick: 'left',
          ts: Date.now()
        });
      }
      
      expect(service.getQueuedCount()).toBe(10);
      
      // Multiple flush attempts
      service.flushChoices().subscribe();
      service.flushChoices().subscribe();
      
      // Should only make one request
      const req = httpMock.expectOne('/discovery/choices');
      expect(req.request.body.length).toBe(10);
      req.flush({});
      
      expect(service.getQueuedCount()).toBe(0);
    });
  });
});