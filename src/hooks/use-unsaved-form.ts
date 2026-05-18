"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Detects if any form on the page has unsaved changes by checking
 * for `data-dirty="true"` attributes on form elements.
 * Forms should set this attribute when their dirty state changes.
 */
export function useUnsavedForm() {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dirtyForms = document.querySelectorAll('[data-dirty="true"]');
      setIsDirty(dirtyForms.length > 0);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-dirty"],
      subtree: true,
    });

    // Initial check
    const dirtyForms = document.querySelectorAll('[data-dirty="true"]');
    setIsDirty(dirtyForms.length > 0);

    return () => observer.disconnect();
  }, []);

  const confirmSwitch = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Are you sure you want to switch organizations? Your changes will be lost.");
  }, [isDirty]);

  return { isDirty, confirmSwitch };
}