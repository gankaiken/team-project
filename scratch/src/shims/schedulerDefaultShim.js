import * as SchedulerNamespace from '/node_modules/scheduler/index.js';

// Normalize CJS/ESM interop for packages that expect both default and named exports.
const scheduler = SchedulerNamespace.default || SchedulerNamespace;

export const unstable_IdlePriority = scheduler.unstable_IdlePriority;
export const unstable_ImmediatePriority = scheduler.unstable_ImmediatePriority;
export const unstable_LowPriority = scheduler.unstable_LowPriority;
export const unstable_NormalPriority = scheduler.unstable_NormalPriority;
export const unstable_UserBlockingPriority = scheduler.unstable_UserBlockingPriority;
export const unstable_cancelCallback = scheduler.unstable_cancelCallback;
export const unstable_continueExecution = scheduler.unstable_continueExecution;
export const unstable_forceFrameRate = scheduler.unstable_forceFrameRate;
export const unstable_getCurrentPriorityLevel = scheduler.unstable_getCurrentPriorityLevel;
export const unstable_getFirstCallbackNode = scheduler.unstable_getFirstCallbackNode;
export const unstable_next = scheduler.unstable_next;
export const unstable_now = scheduler.unstable_now;
export const unstable_pauseExecution = scheduler.unstable_pauseExecution;
export const unstable_requestPaint = scheduler.unstable_requestPaint;
export const unstable_runWithPriority = scheduler.unstable_runWithPriority;
export const unstable_scheduleCallback = scheduler.unstable_scheduleCallback;
export const unstable_shouldYield = scheduler.unstable_shouldYield;
export const unstable_wrapCallback = scheduler.unstable_wrapCallback;

export default scheduler;
