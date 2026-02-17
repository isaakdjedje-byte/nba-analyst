/**
 * PolicyParameterInput Component
 * Story 5.2: Interface admin de gestion des paramètres policy
 * 
 * Requirements:
 * - AC3: Validate input against safe bounds
 * - Display current value, safe min/max bounds, description
 * - Accessibility: WCAG 2.2 AA, keyboard navigation, touch targets >= 44x44px
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { PolicyParameter } from '../types/config';
import { POLICY_CATEGORY_CONFIG } from '../types/config';

function isPercentParameter(parameter: PolicyParameter): boolean {
  return (
    parameter.category === 'confidence' ||
    parameter.category === 'edge' ||
    parameter.category === 'data_quality' ||
    parameter.key.includes('Percent')
  );
}

function formatValue(value: number, parameter: PolicyParameter): string {
  if (isPercentParameter(parameter)) {
    return (value * 100).toFixed(1);
  }
  return value.toString();
}

function parseValue(input: string, parameter: PolicyParameter): number {
  const num = parseFloat(input);
  if (isPercentParameter(parameter)) {
    return num / 100;
  }
  return num;
}

interface PolicyParameterInputProps {
  parameter: PolicyParameter;
  onUpdate: (key: string, value: number, reason?: string) => Promise<{ success: boolean; error?: string }>;
  onValidate: (key: string, value: number, minValue: number, maxValue: number) => { valid: boolean; error?: string };
  isUpdating: boolean;
  disabled?: boolean;
}

export function PolicyParameterInput({
  parameter,
  onUpdate,
  onValidate,
  isUpdating,
  disabled = false,
}: PolicyParameterInputProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const categoryConfig = POLICY_CATEGORY_CONFIG[parameter.category];

  // Initialize input value when parameter loads
  useEffect(() => {
    setInputValue(formatValue(parameter.currentValue, parameter));
    setIsDirty(false);
    setLocalError(null);
    setUpdateStatus('idle');
  }, [parameter]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      setIsDirty(true);
      setUpdateStatus('idle');

      // Validate in real-time
      const numValue = parseValue(value, parameter);
      const validation = onValidate(parameter.key, numValue, parameter.minValue, parameter.maxValue);
      
      if (!validation.valid) {
        setLocalError(validation.error || 'Valeur invalide');
      } else {
        setLocalError(null);
      }
    },
    [parameter, onValidate]
  );

  const handleSubmit = useCallback(async () => {
    const numValue = parseValue(inputValue, parameter);
    
    // Final validation
    const validation = onValidate(parameter.key, numValue, parameter.minValue, parameter.maxValue);
    if (!validation.valid) {
      setLocalError(validation.error || 'Valeur invalide');
      return;
    }

    // Show confirmation dialog
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    // Perform update
    setLocalError(null);
    const result = await onUpdate(parameter.key, numValue, reason);

    if (result.success) {
      setUpdateStatus('success');
      setIsDirty(false);
      setShowConfirm(false);
      setReason('');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setUpdateStatus('idle');
      }, 3000);
    } else {
      setUpdateStatus('error');
      setLocalError(result.error || 'Erreur lors de la mise à jour');
    }
  }, [inputValue, parameter, onUpdate, onValidate, showConfirm, reason]);

  const handleCancel = useCallback(() => {
    setInputValue(formatValue(parameter.currentValue, parameter));
    setIsDirty(false);
    setShowConfirm(false);
    setReason('');
    setLocalError(null);
  }, [parameter]);

  // Calculate percentage for display
  const minDisplay = parameter.category === 'confidence' || parameter.category === 'edge' || parameter.category === 'data_quality' || parameter.key.includes('Percent')
    ? (parameter.minValue * 100)
    : parameter.minValue;
  const maxDisplay = parameter.category === 'confidence' || parameter.category === 'edge' || parameter.category === 'data_quality' || parameter.key.includes('Percent')
    ? (parameter.maxValue * 100)
    : parameter.maxValue;
  const currentDisplay = parameter.category === 'confidence' || parameter.category === 'edge' || parameter.category === 'data_quality' || parameter.key.includes('Percent')
    ? (parameter.currentValue * 100)
    : parameter.currentValue;

  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-all duration-200
        ${categoryConfig.bgColor} border-gray-200 dark:border-gray-700
        ${localError ? 'border-red-300 dark:border-red-700' : ''}
        ${updateStatus === 'success' ? 'border-emerald-300 dark:border-emerald-700' : ''}
      `}
      role="group"
      aria-labelledby={`param-${parameter.key}`}
      data-testid={`policy-parameter-${parameter.key}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`
                text-xs font-semibold uppercase tracking-wide
                ${categoryConfig.color}
              `}
            >
              {categoryConfig.label}
            </span>
          </div>
          <h3
            id={`param-${parameter.key}`}
            className="font-semibold text-base text-gray-900 dark:text-gray-100"
          >
            {parameter.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {parameter.description}
          </p>
        </div>

        {/* Current value badge */}
        <div
          className={`
            px-3 py-1 rounded-full text-sm font-mono
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
          `}
        >
          <span className="text-gray-500 dark:text-gray-400">Actuel: </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {currentDisplay.toLocaleString('fr-FR')}{parameter.unit}
          </span>
        </div>
      </div>

      {/* Input section */}
      <div className="mt-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Input field */}
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor={`input-${parameter.key}`}
              className="sr-only"
            >
              {parameter.name}
            </label>
            <div className="relative">
              <input
                id={`input-${parameter.key}`}
                type="number"
                step="0.1"
                min={minDisplay}
                max={maxDisplay}
                value={inputValue}
                onChange={handleInputChange}
                disabled={disabled || isUpdating}
                aria-describedby={`desc-${parameter.key} error-${parameter.key}`}
                className={`
                  w-full px-4 py-3 rounded-lg font-mono text-base
                  border-2 transition-colors duration-200
                  min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${localError
                    ? 'border-red-300 dark:border-red-700 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                  }
                  bg-white dark:bg-gray-900
                  text-gray-900 dark:text-gray-100
                `}
                data-testid={`policy-input-${parameter.key}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {parameter.unit}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isDirty && !showConfirm && (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled || isUpdating || !!localError}
                  className={`
                    px-4 py-2 rounded-lg font-medium
                    min-h-[44px] min-w-[44px]
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    bg-blue-600 hover:bg-blue-700
                    text-white
                  `}
                  data-testid={`policy-save-${parameter.key}`}
                >
                  {isUpdating ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    'Enregistrer'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={disabled || isUpdating}
                  className={`
                    px-4 py-2 rounded-lg font-medium
                    min-h-[44px] min-w-[44px]
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                    text-gray-700 dark:text-gray-300
                  `}
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        </div>

        {/* Confirmation dialog */}
        {showConfirm && (
          <div
            className={`
              mt-3 p-3 rounded-lg
              bg-amber-50 dark:bg-amber-900/20
              border border-amber-200 dark:border-amber-800
            `}
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Confirmer le changement
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Nouvelle valeur: <strong>{inputValue}{parameter.unit}</strong>
                </p>
                <div className="mt-2">
                  <label
                    htmlFor={`reason-${parameter.key}`}
                    className="block text-xs font-medium text-amber-800 dark:text-amber-200"
                  >
                    Raison du changement (obligatoire)
                  </label>
                  <input
                    id={`reason-${parameter.key}`}
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Ajustement pour les matches NBA..."
                    className={`
                      mt-1 w-full px-3 py-2 rounded text-sm
                      border border-amber-300 dark:border-amber-600
                      bg-white dark:bg-gray-800
                      focus:outline-none focus:ring-2 focus:ring-amber-500
                    `}
                    data-testid={`policy-reason-${parameter.key}`}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!reason.trim() || isUpdating}
                    className={`
                      px-3 py-1.5 rounded font-medium text-sm
                      min-h-[44px]
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      bg-amber-600 hover:bg-amber-700
                      text-white
                    `}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className={`
                      px-3 py-1.5 rounded font-medium text-sm
                      min-h-[44px]
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                      bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                      text-gray-700 dark:text-gray-300
                    `}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bounds info */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Min: <strong>{minDisplay.toLocaleString('fr-FR')}{parameter.unit}</strong>
          </span>
          <span>
            Max: <strong>{maxDisplay.toLocaleString('fr-FR')}{parameter.unit}</strong>
          </span>
        </div>

        {/* Error message */}
        {localError && (
          <div
            id={`error-${parameter.key}`}
            role="alert"
            className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {/* Success message */}
        {updateStatus === 'success' && (
          <div
            role="status"
            className="mt-2 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>Configuration mise à jour avec succès</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PolicyParameterInput;
