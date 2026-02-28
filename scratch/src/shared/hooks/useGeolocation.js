import { useState, useEffect } from 'react';
export const useGeolocation = (defaultCoords = { lat: 1.4927, lng: 103.7414 }) => {
    const [location, setLocation] = useState(defaultCoords);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (err) => console.warn(`Geolocation error (${err.code}): ${err.message}.`),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }, []);

    return { location, error };
};


