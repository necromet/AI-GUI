import { useEffect, useRef, useState } from "react"

interface TextGlitchProps {
  text: string
  hoverText?: string
  href?: string
  className?: string
  delay?: number
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function TextGlitch({ text, hoverText, href, className = "", delay = 0 }: TextGlitchProps) {
  const textRef = useRef<HTMLHeadingElement>(null)
  const spanRef = useRef<HTMLSpanElement>(null)
  const [displayText] = useState(text)
  const [displayHoverText, setDisplayHoverText] = useState(hoverText || text)
  const [isHovered, setIsHovered] = useState(false)
  const hoverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const loadGSAP = async () => {
      const { gsap } = await import("gsap")

      if (textRef.current) {
        gsap.set(textRef.current, {
          backgroundSize: "0%",
          scale: 0.95,
          opacity: 0.7,
        })

        const tl = gsap.timeline({ delay })

        tl.to(textRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.7)",
        }).to(
          textRef.current,
          {
            backgroundSize: "100%",
            duration: 2,
            ease: "elastic.out(1, 0.5)",
          },
          "-=0.3",
        )
      }
    }

    loadGSAP()
  }, [delay])

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (hoverText) {
      let iteration = 0

      if (hoverIntervalRef.current) {
        clearInterval(hoverIntervalRef.current)
      }

      hoverIntervalRef.current = setInterval(() => {
        setDisplayHoverText(
          hoverText
            .split("")
            .map((letter, index) => {
              if (index < iteration) {
                return hoverText[index]
              }
              return LETTERS[Math.floor(Math.random() * 26)]
            })
            .join(""),
        )

        if (iteration >= hoverText.length) {
          clearInterval(hoverIntervalRef.current!)
        }

        iteration += 1 / 3
      }, 30)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (hoverIntervalRef.current) {
      clearInterval(hoverIntervalRef.current)
    }
    setDisplayHoverText(hoverText || text)
  }

  useEffect(() => {
    return () => {
      if (hoverIntervalRef.current) {
        clearInterval(hoverIntervalRef.current)
      }
    }
  }, [])

  const spanContent = hoverText ? (
    href ? (
      <a href={href} target="_blank" rel="noreferrer" className="no-underline text-inherit">
        {displayHoverText}
      </a>
    ) : (
      displayHoverText
    )
  ) : (
    text
  )

  return (
    <h1
      ref={textRef}
      className={`
        text-[5vw] font-bold leading-none tracking-tight m-0 
        text-neutral-600/20
        bg-gradient-to-r from-neutral-700 to-neutral-500 bg-clip-text bg-no-repeat
        border-b border-neutral-600/20
        flex flex-col items-center justify-center relative
        transition-all duration-500 ease-out
        cursor-pointer
        overflow-hidden
        ${className}
      `}
      style={{
        backgroundSize: "0%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        width: "100%",
        maxWidth: "100vw",
        wordBreak: "break-word",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
      <span
        ref={spanRef}
        className="
          absolute w-full h-full 
          text-black font-bold
          flex flex-col items-center justify-center
          pointer-events-none
          overflow-hidden
        "
        style={{
          clipPath: isHovered
            ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
            : "polygon(0 50%, 100% 50%, 100% 50%, 0 50%)",
          transition: "clip-path 400ms ease-out",
          transformOrigin: "center",
          backgroundColor: "#FFFF02",
          maxWidth: "100%",
          whiteSpace: "nowrap",
        }}
      >
        {spanContent}
      </span>
    </h1>
  )
}
