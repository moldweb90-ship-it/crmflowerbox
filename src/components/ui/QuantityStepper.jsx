import React from 'react'

const parseAmount = (value, fallback = 0) => {
    if (value === '' || value === null || value === undefined) return fallback
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : fallback
}

const formatAmount = (value, preferComma = true) => {
    const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000
    const text = String(rounded).replace(/\.?0+$/, '')
    return preferComma ? text.replace('.', ',') : text
}

const cleanInput = (value) => String(value).replace(/[^0-9.,]/g, '')

export default function QuantityStepper({
    value,
    onChange,
    min = 0.01,
    max = null,
    step = 1,
    disabled = false,
    unit = '',
    placeholder = '',
    className = '',
    style = {},
    inputStyle = {},
    buttonStyle = {}
}) {
    const currentText = value === null || value === undefined ? '' : String(value)
    const preferComma = currentText.includes(',') || !currentText.includes('.')

    const bump = (direction) => {
        if (disabled) return
        const current = parseAmount(currentText, 0)
        const nextRaw = current + direction * step
        const boundedMin = Math.max(min, nextRaw)
        const next = max === null || max === undefined ? boundedMin : Math.min(max, boundedMin)
        onChange(formatAmount(next, preferComma))
    }

    return (
        <div className={`qty-stepper ${className}`.trim()} style={style}>
            <span className="qty-stepper-field">
                <input
                    type="text"
                    inputMode="decimal"
                    className="qty-stepper-input"
                    disabled={disabled}
                    value={currentText}
                    placeholder={placeholder}
                    onChange={e => onChange(cleanInput(e.target.value))}
                    style={inputStyle}
                />
                <span className="qty-stepper-arrows">
                    <button
                        type="button"
                        className="qty-stepper-arrow qty-stepper-arrow-up"
                        disabled={disabled}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => bump(1)}
                        style={buttonStyle}
                        tabIndex={-1}
                        aria-label="Increase quantity"
                    />
                    <button
                        type="button"
                        className="qty-stepper-arrow qty-stepper-arrow-down"
                        disabled={disabled}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => bump(-1)}
                        style={buttonStyle}
                        tabIndex={-1}
                        aria-label="Decrease quantity"
                    />
                </span>
            </span>
            {unit ? <span className="qty-stepper-unit">{unit}</span> : null}
        </div>
    )
}
