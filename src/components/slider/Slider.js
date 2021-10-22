import React, { useState, useEffect, useRef } from 'react'
import './Slider.css';

const Slider = ({
    orientation, //vertical or horizontal
    title,
    min,
    max,
    defaultValue,
    onChange
}) => {

    const [range, setRange] = useState(defaultValue)
    const timeout = useRef(null)

    useEffect(() => {
        onChange(range)
    }, [onChange, range])

    const handleChangeDebounce = (e) => {
        setRange(e.target.value);
    };

    const reset = () => {
        setRange(defaultValue)
    }

    useEffect(() => () => {
        if (timeout.current) clearTimeout(timeout.current);
    }, [])

    const renderHorizontalSlider = () => (
        <div className='row'>
            <div className='xInnerSliderContainer'>
                <span className='xSliderTitle'>{title}</span>
                <input
                    className='xSlider'
                    type="range"
                    min={min}
                    max={max}
                    value={range}
                    onChange={handleChangeDebounce}
                />
            </div>
            <button
                className='resetButton'
                onClick={reset}
            >
                reset
            </button>
        </div>
    )

    const renderVerticalSlider = () => (
        <div className='column'>
            <div className='yInnerSliderContainer'>
                <input
                    className='ySlider'
                    type="range"
                    min={min}
                    max={max}
                    value={range}
                    onChange={handleChangeDebounce}
                />
                <span className='ySliderTitle'>{title}</span>
            </div>
            <button
                className='resetButton'
                onClick={reset}>
                reset
            </button>
        </div>
    )

    return (
        <>
            {orientation === 'vertical' ? renderVerticalSlider() : renderHorizontalSlider()}
        </>
    )
}

export default Slider