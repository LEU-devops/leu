import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T extends string | number> {
    value: T
    label: string
    icon?: ReactNode
    disabled?: boolean
}

interface Props<T extends string | number> {
    value: T | ''
    options: SelectOption<T>[]
    onChange: (value: T) => void
    placeholder?: string
    className?: string
}

/**
 * Styled replacement for a native <select>. The list is rendered in a portal
 * with fixed positioning, so it is never clipped by scrolling containers.
 */
export default function Select<T extends string | number>({ value, options, onChange, placeholder = 'Selecione...', className = '' }: Props<T>) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlighted, setHighlighted] = useState(-1)
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const listId = useId()

    const selected = options.find((option) => option.value === value) ?? null

    useLayoutEffect(() => {
        if (!isOpen || !buttonRef.current) return
        const rect = buttonRef.current.getBoundingClientRect()
        setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return

        function close() {
            setIsOpen(false)
        }
        function isInside(target: EventTarget | null) {
            const node = target as Node | null
            return Boolean(node && (buttonRef.current?.contains(node) || listRef.current?.contains(node)))
        }
        function onPointerDown(event: PointerEvent) {
            if (!isInside(event.target)) close()
        }
        // Scrolling the page moves the anchor, so close; scrolling the list itself is fine.
        function onScroll(event: Event) {
            if (!listRef.current?.contains(event.target as Node)) close()
        }

        document.addEventListener('pointerdown', onPointerDown)
        window.addEventListener('resize', close)
        window.addEventListener('scroll', onScroll, true)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            window.removeEventListener('resize', close)
            window.removeEventListener('scroll', onScroll, true)
        }
    }, [isOpen])

    function open() {
        setHighlighted(selected ? options.indexOf(selected) : options.findIndex((o) => !o.disabled))
        setIsOpen(true)
    }

    function choose(option: SelectOption<T>) {
        if (option.disabled) return
        onChange(option.value)
        setIsOpen(false)
        buttonRef.current?.focus()
    }

    function move(step: 1 | -1) {
        let index = highlighted
        for (let i = 0; i < options.length; i++) {
            index = (index + step + options.length) % options.length
            if (!options[index].disabled) break
        }
        setHighlighted(index)
        listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
    }

    function onKeyDown(event: React.KeyboardEvent) {
        if (!isOpen) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault()
                open()
            }
            return
        }
        switch (event.key) {
            case 'ArrowDown': event.preventDefault(); move(1); break
            case 'ArrowUp': event.preventDefault(); move(-1); break
            case 'Enter':
            case ' ':
                event.preventDefault()
                if (options[highlighted]) choose(options[highlighted])
                break
            case 'Escape':
            case 'Tab':
                setIsOpen(false)
                break
        }
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => (isOpen ? setIsOpen(false) : open())}
                onKeyDown={onKeyDown}
                className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none transition ${
                    isOpen ? 'border-red-600 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
                } focus-visible:border-red-600 ${className}`}
            >
                {selected?.icon}
                <span className={`flex-1 truncate ${selected ? 'text-zinc-50' : 'text-zinc-500'}`}>{selected?.label ?? placeholder}</span>
                <svg className={`h-4 w-4 shrink-0 text-zinc-400 transition ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen
                ? createPortal(
                      <ul
                          ref={listRef}
                          id={listId}
                          role="listbox"
                          style={{ position: 'fixed', top: position.top, left: position.left, minWidth: position.width }}
                          className="z-50 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 backdrop-blur"
                      >
                          {options.length === 0 ? <li className="px-3 py-2 text-sm text-zinc-500">Nenhuma opção</li> : null}
                          {options.map((option, index) => {
                              const isSelected = option.value === value
                              return (
                                  <li
                                      key={option.value}
                                      role="option"
                                      aria-selected={isSelected}
                                      aria-disabled={option.disabled}
                                      onMouseEnter={() => !option.disabled && setHighlighted(index)}
                                      onClick={() => choose(option)}
                                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                                          option.disabled
                                              ? 'cursor-not-allowed text-zinc-600'
                                              : index === highlighted
                                                ? 'bg-red-950/60 text-zinc-50'
                                                : 'text-zinc-200'
                                      } ${isSelected && !option.disabled ? 'font-semibold' : ''}`}
                                  >
                                      <span className={option.disabled ? 'opacity-40' : ''}>{option.icon}</span>
                                      <span className="flex-1 truncate">{option.label}</span>
                                      {isSelected ? <span className="text-red-400">✓</span> : null}
                                  </li>
                              )
                          })}
                      </ul>,
                      document.body,
                  )
                : null}
        </>
    )
}
