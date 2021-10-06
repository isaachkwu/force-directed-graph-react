import { useState, useEffect } from 'react';

export default function useWindowDimension() {
    const [dimension, setDimension] = useState({
        width: window.innerWidth, height: window.innerHeight});

    useEffect(() => {
        let resizeTimer;
        const waitResize = () => {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(handleResize, 100)
        }

        const handleResize = () => {
            setDimension({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }
        window.addEventListener('resize', waitResize)

        return () => {
            window.removeEventListener("resize", waitResize)
            clearTimeout(resizeTimer);
        }
    }, [])

    return dimension
}