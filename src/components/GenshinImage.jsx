import { useState } from 'react'

export default function GenshinImage({ src, alt, className, fallback }) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return <>{fallback}</>
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      onError={() => setHasError(true)} 
    />
  )
}
