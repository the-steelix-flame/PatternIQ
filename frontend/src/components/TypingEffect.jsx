import React, { useState, useEffect } from 'react';

// A simple component to render text with a typing animation
const TypingEffect = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        setDisplayedText(''); // Reset on new text
        let index = 0;
        const intervalId = setInterval(() => {
            setDisplayedText((prev) => prev + text[index]);
            index++;
            if (index === text.length) {
                clearInterval(intervalId);
                if (onComplete) onComplete(); // Notify parent when done
            }
        }, 30); // Adjust speed of typing here (lower is faster)

        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, [text, onComplete]);

    return <span>{displayedText}</span>;
};

export default TypingEffect;