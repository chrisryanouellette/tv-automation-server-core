import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'

import { SEGMENT_TIMELINE_ELEMENT_ID } from '../ui/SegmentTimeline/SegmentTimeline'
import { Parts, PartId } from '../../lib/collections/Parts'
import { PartInstances, PartInstanceId } from '../../lib/collections/PartInstances'
import { SegmentId } from '../../lib/collections/Segments'
import { isProtectedString } from '../../lib/lib'
import { RundownViewEvents, IGoToPartEvent, IGoToPartInstanceEvent } from '../ui/RundownView'

let focusInterval: NodeJS.Timer | undefined
let _dontClearInterval: boolean = false

export function maintainFocusOnPartInstance (partInstanceId: PartInstanceId, timeWindow: number, forceScroll?: boolean, noAnimation?: boolean) {
	let startTime = Date.now()
	const focus = () => {
		// console.log("focus");
		if (Date.now() - startTime < timeWindow) {
			_dontClearInterval = true
			scrollToPartInstance(partInstanceId, forceScroll, noAnimation).then(() => {
				_dontClearInterval = false
			}).catch(() => {
				_dontClearInterval = false
			})
		} else {
			quitFocusOnPart()
		}
	}
	focusInterval = setInterval(focus, 500)
	focus()
}

export function isMaintainingFocus (): boolean {
	return !!focusInterval
}

function quitFocusOnPart () {
	if (!_dontClearInterval && focusInterval) {
		// console.log("quitFocusOnPart")
		clearInterval(focusInterval)
		focusInterval = undefined
	}
}

export function scrollToPartInstance (partInstanceId: PartInstanceId, forceScroll?: boolean, noAnimation?: boolean): Promise<boolean> {
	quitFocusOnPart()
	const partInstance = PartInstances.findOne(partInstanceId)
	if (partInstance) {
		window.dispatchEvent(
			new CustomEvent<IGoToPartInstanceEvent>(
				RundownViewEvents.goToPart, {
					detail: {
						segmentId: partInstance.segmentId,
						partInstanceId: partInstanceId
					}
				}))
		return scrollToSegment(partInstance.segmentId, forceScroll, noAnimation)
	}
	return Promise.reject('Could not find PartInstance')
}

export function scrollToPart (partId: PartId, forceScroll?: boolean, noAnimation?: boolean): Promise<boolean> {
	quitFocusOnPart()
	let part = Parts.findOne(partId)
	if (part) {
		window.dispatchEvent(
			new CustomEvent<IGoToPartEvent>(
				RundownViewEvents.goToPart, {
					detail: {
						segmentId: part.segmentId,
						partId: partId
					}
				}))
		return scrollToSegment(part.segmentId, forceScroll, noAnimation)
	}
	return Promise.reject('Could not find part')
}

const HEADER_HEIGHT = 175

export function scrollToSegment (elementToScrollToOrSegmentId: HTMLElement | SegmentId, forceScroll?: boolean, noAnimation?: boolean): Promise<boolean> {
	let elementToScrollTo: HTMLElement | null = (
		isProtectedString(elementToScrollToOrSegmentId) ?
			document.querySelector('#' + SEGMENT_TIMELINE_ELEMENT_ID + elementToScrollToOrSegmentId) :
			elementToScrollToOrSegmentId
	)

	if (!elementToScrollTo) {
		return Promise.reject('Could not find segment element')
	}

	let { top, bottom } = elementToScrollTo.getBoundingClientRect()
	top += window.scrollY
	bottom += window.scrollY

	// check if the item is in viewport
	if (forceScroll ||
		bottom > window.scrollY + window.innerHeight ||
		top < window.scrollY + HEADER_HEIGHT) {

		return scrollToPosition(top, noAnimation).then(() => true)
	}

	return Promise.resolve(false)
}

export function scrollToPosition (scrollPosition: number, noAnimation?: boolean): Promise<void> {
	if (noAnimation) {
		return new Promise((resolve, reject) => {
			window.scroll({
				top: Math.max(0, scrollPosition - HEADER_HEIGHT),
				left: 0
			})
			resolve()
		})
	} else {
		return new Promise((resolve, reject) => {
			window.requestIdleCallback(() => {
				window.scroll({
					top: Math.max(0, scrollPosition - HEADER_HEIGHT),
					left: 0,
					behavior: 'smooth'
				})
				resolve()
			}, { timeout: 250 })
		})
	}
}
