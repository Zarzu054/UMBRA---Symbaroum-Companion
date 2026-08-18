import { useEffect, useState } from "react";
function matchesMediaQuery(query) {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : false;
}
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => matchesMediaQuery(query));
    useEffect(() => {
        if (typeof window.matchMedia !== "function")
            return;
        const media = window.matchMedia(query);
        const handleChange = (event) => setMatches(event.matches);
        setMatches(media.matches);
        media.addEventListener("change", handleChange);
        return () => media.removeEventListener("change", handleChange);
    }, [query]);
    return matches;
}
