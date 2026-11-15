import { useState } from 'react'

export default function GenshinImage({ src, alt, className, fallback, loading }) {
  const [prevSrc, setPrevSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  if (prevSrc !== src) {
    setPrevSrc(src)
    setHasError(false)
  }

  if (!src || hasError) {
    return <>{fallback}</>
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      loading={loading}
      decoding="async"
      onError={() => setHasError(true)} 
    />
  )
}
