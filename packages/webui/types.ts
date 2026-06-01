type Point = [number, number]

interface BaseAnnotation {
  color: string
  type: 'box' | 'line' | 'arrow' | 'freehand'
}

export interface BoxAnnotation extends BaseAnnotation {
  type: 'box'
  points: [Point, Point] // [top-left, bottom-right]
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line'
  points: [Point, Point] // [start, end]
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow'
  points: [Point, Point] // [start, end]
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand'
  points: Point[]
}

export type Annotation = BoxAnnotation | LineAnnotation | ArrowAnnotation | FreehandAnnotation
