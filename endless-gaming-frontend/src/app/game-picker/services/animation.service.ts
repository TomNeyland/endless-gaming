import { Injectable } from '@angular/core';

/**
 * Service for handling smooth animations and transitions.
 * 
 * Provides FLIP (First, Last, Invert, Play) animations for smooth reordering,
 * staggered animations, and other UI transitions for the voting system.
 */
@Injectable({
  providedIn: 'root'
})
export class AnimationService {

  private readonly ANIMATION_DURATION = 300; // milliseconds
  private readonly STAGGER_DELAY = 50; // milliseconds between staggered items
  private readonly EASING = 'cubic-bezier(0.4, 0.0, 0.2, 1)'; // Material Design easing

  /**
   * Animate elements using FLIP technique for smooth reordering.
   * Tracks element positions before and after DOM changes for smooth transitions.
   */
  animateReorder(
    container: HTMLElement, 
    selector: string = '.premium-card, .compact-item'
  ): Promise<void> {
    return new Promise((resolve) => {
      const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
      
      if (elements.length === 0) {
        resolve();
        return;
      }

      // FIRST: Record initial positions
      const firstPositions = new Map<HTMLElement, DOMRect>();
      elements.forEach(el => {
        firstPositions.set(el, el.getBoundingClientRect());
      });

      // Allow DOM update to occur (this happens outside this function)
      requestAnimationFrame(() => {
        // LAST: Record final positions after DOM update
        const lastPositions = new Map<HTMLElement, DOMRect>();
        elements.forEach(el => {
          lastPositions.set(el, el.getBoundingClientRect());
        });

        // INVERT: Calculate transforms needed to move elements back to first position
        const transforms: Array<{ element: HTMLElement, deltaX: number, deltaY: number }> = [];
        
        elements.forEach(el => {
          const first = firstPositions.get(el);
          const last = lastPositions.get(el);
          
          if (first && last) {
            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;
            
            if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
              transforms.push({ element: el, deltaX, deltaY });
              
              // Apply transform instantly (invert)
              el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
              el.style.transition = 'none';
            }
          }
        });

        // PLAY: Animate to final position
        if (transforms.length > 0) {
          requestAnimationFrame(() => {
            let completedAnimations = 0;
            const totalAnimations = transforms.length;

            transforms.forEach(({ element }, index) => {
              // Stagger the animations slightly
              setTimeout(() => {
                element.style.transition = `transform ${this.ANIMATION_DURATION}ms ${this.EASING}`;
                element.style.transform = 'translate(0, 0)';

                // Listen for animation completion
                const handleTransitionEnd = () => {
                  element.removeEventListener('transitionend', handleTransitionEnd);
                  element.style.transition = '';
                  element.style.transform = '';
                  
                  completedAnimations++;
                  if (completedAnimations === totalAnimations) {
                    resolve();
                  }
                };

                element.addEventListener('transitionend', handleTransitionEnd);
                
                // Fallback timeout in case transitionend doesn't fire
                setTimeout(() => {
                  if (completedAnimations < totalAnimations) {
                    handleTransitionEnd();
                  }
                }, this.ANIMATION_DURATION + 100);
                
              }, index * this.STAGGER_DELAY);
            });
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Animate elements entering the view with staggered fade-in.
   */
  animateEnter(elements: HTMLElement[]): Promise<void> {
    return new Promise((resolve) => {
      if (elements.length === 0) {
        resolve();
        return;
      }

      // Initially hide all elements
      elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'none';
      });

      let completedAnimations = 0;
      const totalAnimations = elements.length;

      elements.forEach((el, index) => {
        setTimeout(() => {
          el.style.transition = `opacity ${this.ANIMATION_DURATION}ms ${this.EASING}, transform ${this.ANIMATION_DURATION}ms ${this.EASING}`;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';

          const handleTransitionEnd = () => {
            el.removeEventListener('transitionend', handleTransitionEnd);
            el.style.transition = '';
            el.style.transform = '';
            
            completedAnimations++;
            if (completedAnimations === totalAnimations) {
              resolve();
            }
          };

          el.addEventListener('transitionend', handleTransitionEnd);
          
          // Fallback timeout
          setTimeout(() => {
            if (completedAnimations < totalAnimations) {
              handleTransitionEnd();
            }
          }, this.ANIMATION_DURATION + 100);
          
        }, index * this.STAGGER_DELAY);
      });
    });
  }

  /**
   * Animate elements leaving the view with staggered fade-out.
   */
  animateLeave(elements: HTMLElement[]): Promise<void> {
    return new Promise((resolve) => {
      if (elements.length === 0) {
        resolve();
        return;
      }

      let completedAnimations = 0;
      const totalAnimations = elements.length;

      elements.forEach((el, index) => {
        setTimeout(() => {
          el.style.transition = `opacity ${this.ANIMATION_DURATION}ms ${this.EASING}, transform ${this.ANIMATION_DURATION}ms ${this.EASING}`;
          el.style.opacity = '0';
          el.style.transform = 'translateY(-20px)';

          const handleTransitionEnd = () => {
            el.removeEventListener('transitionend', handleTransitionEnd);
            completedAnimations++;
            if (completedAnimations === totalAnimations) {
              resolve();
            }
          };

          el.addEventListener('transitionend', handleTransitionEnd);
          
          // Fallback timeout
          setTimeout(() => {
            if (completedAnimations < totalAnimations) {
              handleTransitionEnd();
            }
          }, this.ANIMATION_DURATION + 100);
          
        }, index * this.STAGGER_DELAY);
      });
    });
  }

  /**
   * Animate a brief highlight effect on elements.
   * Useful for showing which cards changed position.
   */
  animateHighlight(elements: HTMLElement[], color: string = '#1976d2'): Promise<void> {
    return new Promise((resolve) => {
      if (elements.length === 0) {
        resolve();
        return;
      }

      let completedAnimations = 0;
      const totalAnimations = elements.length;

      elements.forEach((el, index) => {
        setTimeout(() => {
          const originalBoxShadow = el.style.boxShadow;
          const originalTransform = el.style.transform;
          
          // Apply highlight effect
          el.style.transition = `box-shadow 150ms ${this.EASING}, transform 150ms ${this.EASING}`;
          el.style.boxShadow = `0 0 20px ${color}66`;
          el.style.transform = `${originalTransform} scale(1.02)`;

          // Remove highlight after brief delay
          setTimeout(() => {
            el.style.transition = `box-shadow 300ms ${this.EASING}, transform 300ms ${this.EASING}`;
            el.style.boxShadow = originalBoxShadow;
            el.style.transform = originalTransform;

            setTimeout(() => {
              el.style.transition = '';
              completedAnimations++;
              if (completedAnimations === totalAnimations) {
                resolve();
              }
            }, 300);
          }, 200);
          
        }, index * (this.STAGGER_DELAY / 2)); // Faster stagger for highlights
      });
    });
  }

  /**
   * Animate vote feedback on buttons.
   */
  animateVoteFeedback(button: HTMLElement, type: 'success' | 'skip' = 'success'): Promise<void> {
    return new Promise((resolve) => {
      const originalScale = button.style.transform || 'scale(1)';
      const originalBackground = button.style.backgroundColor;
      
      const color = type === 'success' ? '#4caf50' : '#ff9800';
      
      // Quick scale and color change
      button.style.transition = `transform 100ms ${this.EASING}, background-color 100ms ${this.EASING}`;
      button.style.transform = 'scale(0.95)';
      button.style.backgroundColor = color;

      setTimeout(() => {
        button.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
          button.style.transform = originalScale;
          button.style.backgroundColor = originalBackground;
          
          setTimeout(() => {
            button.style.transition = '';
            resolve();
          }, 150);
        }, 100);
      }, 100);
    });
  }

  /**
   * Animate loading shimmer effect.
   */
  createShimmerEffect(element: HTMLElement): () => void {
    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer-effect';
    shimmer.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 1.5s infinite;
      pointer-events: none;
      z-index: 1;
    `;

    // Add keyframes if not already present
    if (!document.querySelector('#shimmer-keyframes')) {
      const style = document.createElement('style');
      style.id = 'shimmer-keyframes';
      style.textContent = `
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `;
      document.head.appendChild(style);
    }

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(shimmer);

    // Return cleanup function
    return () => {
      if (shimmer.parentNode) {
        shimmer.parentNode.removeChild(shimmer);
      }
    };
  }

  /**
   * Get animation duration for external coordination.
   */
  getAnimationDuration(): number {
    return this.ANIMATION_DURATION;
  }

  /**
   * Get stagger delay for external coordination.
   */
  getStaggerDelay(): number {
    return this.STAGGER_DELAY;
  }
}