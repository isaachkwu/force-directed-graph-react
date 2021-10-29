import { useState, useEffect, useLayoutEffect } from 'react';

export default function useComponentDimension(ref) {
    const [dimension, setDimension] = useState({});
    useLayoutEffect(() => {
        setDimension({
            width: ref.current.offsetWidth,
            height: ref.current.offsetHeight
        });
        let resizeTimer;
        const waitResize = () => {
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(handleResize, 150)
        }

        const handleResize = () => {
            setDimension({
                width: ref.current.offsetWidth,
                height: ref.current.offsetHeight
            })
        }
        window.addEventListener('resize', waitResize)

        return () => {
            window.removeEventListener("resize", waitResize)
            clearTimeout(resizeTimer);
        }
    }, [ref])

    return dimension
}