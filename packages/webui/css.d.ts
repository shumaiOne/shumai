declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

declare module '*?url' {
  const content: string
  export default content
}
