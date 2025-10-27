/**
 * Utility to calculate modal position relative to a trigger element
 */

export const calculateModalPosition = (triggerElement: HTMLElement | null, modalWidth: number = 380) => {
  if (!triggerElement) {
    return { top: 0, right: 0 }
  }

  const rect = triggerElement.getBoundingClientRect()
  const scrollX = window.scrollX || window.pageXOffset
  const scrollY = window.scrollY || window.pageYOffset

  // Position modal below the trigger element
  const top = rect.bottom + scrollY + 10
  const right = window.innerWidth - rect.right

  return { top, right }
}

export const calculateModalPositionAbsolute = (triggerElement: HTMLElement | null, modalWidth: number = 380) => {
  if (!triggerElement) {
    return { top: '0px', right: '0px', arrowRight: '50px' }
  }

  const rect = triggerElement.getBoundingClientRect()
  const windowWidth = window.innerWidth
  
  // Calculate arrow position to point at the center of the cart button
  const triggerWidth = rect.width
  const triggerCenter = triggerWidth / 2
  
  // Position modal below and aligned with trigger element
  let right = windowWidth - rect.right
  
  // If modal would overflow left, align to right edge of viewport
  if (rect.right - modalWidth < 0) {
    right = 10
    // Adjust arrow to point to the edge of the viewport
    return {
      top: `${rect.bottom + 10}px`,
      right: `${right}px`,
      arrowRight: `${windowWidth - rect.right - 10}px`
    }
  }
  
  // Position arrow to point at the center of the cart button
  const arrowRight = modalWidth - triggerCenter - 8 // 8px is half arrow size

  return {
    top: `${rect.bottom + 10}px`,
    right: `${right}px`,
    arrowRight: `${arrowRight}px`
  }
}

