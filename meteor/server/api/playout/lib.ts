import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState, DBRundown } from '../../../lib/collections/Rundowns'
import { Parts, DBPart, Part } from '../../../lib/collections/Parts'
import {
	asyncCollectionUpdate,
	waitForPromiseAll,
	Time,
	clone,
	literal,
	asyncCollectionInsert,
	getCurrentTime
} from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { DBSegment, Segments } from '../../../lib/collections/Segments'
import { PartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance, PieceInstanceFromPiece } from '../../../lib/collections/PieceInstances'
import { Pieces } from '../../../lib/collections/Pieces'

/**
 * Reset the rundown:
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundown (rundown: Rundown) {
	logger.info('resetRundown ' + rundown._id)

	PartInstances.remove({
		rundownId: rundown._id
	})
	PieceInstances.remove({
		rundownId: rundown._id
	})

	// const dirtyParts = Parts.find({
	// 	rundownId: rundown._id,
	// 	dirty: true
	// }).fetch()
	// dirtyParts.forEach(part => {
	// 	refreshPart(rundown, part)
	// 	Parts.update(part._id, {$unset: {
	// 		dirty: 1
	// 	}})
	// })

	// ensure that any removed infinites are restored
	// updateSourceLayerInfinitesAfterPart(rundown)

	resetRundownPlayhead(rundown)
}
function resetRundownPlayhead (rundown: Rundown) {
	logger.info('resetRundownPlayhead ' + rundown._id)
	let parts = rundown.getParts()

	Rundowns.update(rundown._id, {
		$set: literal<Partial<DBRundown>>({
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		}), $unset: {
			startedPlayback: 1
		}
	})

	if (rundown.active) {
		// put the first on queue:
		setNextPart(rundown, _.first(parts) || null)
	} else {
		setNextPart(rundown, null)
	}
}
export function getPreviousPartForSegment (rundownId: string, dbSegment: DBSegment): Part | undefined {
	const prevSegment = Segments.findOne({
		rundownId: rundownId,
		_rank: { $lt: dbSegment._rank }
	}, { sort: { _rank: -1 } })
	if (prevSegment) {
		return Parts.findOne({
			rundownId: rundownId,
			segmentId: prevSegment._id,
		}, { sort: { _rank: -1 } })
	}
	return undefined
}
// function getPreviousPart (dbRundown: DBRundown, dbPart: DBPart) {
// 	return Parts.findOne({
// 		rundownId: dbRundown._id,
// 		_rank: { $lt: dbPart._rank }
// 	}, { sort: { _rank: -1 } })
// }
export function refreshPart (dbRundown: DBRundown, dbPart: DBPart) {
	// const ingestSegment = loadCachedIngestSegment(dbRundown._id, dbRundown.externalId, dbPart.segmentId, dbPart.segmentId)

	// const studio = Studios.findOne(dbRundown.studioId)
	// if (!studio) throw new Meteor.Error(404, `Studio ${dbRundown.studioId} was not found`)
	// const rundown = new Rundown(dbRundown)

	// updateSegmentFromIngestData(studio, rundown, ingestSegment)

	// const segment = Segments.findOne(dbPart.segmentId)
	// if (!segment) throw new Meteor.Error(404, `Segment ${dbPart.segmentId} was not found`)

	// const prevPart = getPreviousPartForSegment(dbRundown._id, segment)
	// updateSourceLayerInfinitesAfterPart(rundown, prevPart)

	throw new Meteor.Error(404, `Nto implemented yet`)
}
export function setNextPart (
	rundown: Rundown,
	nextPart: DBPart | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
): string | null {
	let nextPartInstanceId: string | null = null
	let ps: Array<Promise<any>> = []
	if (nextPart) {

		if (nextPart.rundownId !== rundown._id) throw new Meteor.Error(409, `Part "${nextPart._id}" not part of rundown "${rundown._id}"`)
		// if (nextPart._id === rundown.currentPartId) {
		// 	throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
		// }
		if (nextPart.invalid) {
			throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
		}

		nextPartInstanceId = Random.id()
		ps.push(asyncCollectionInsert(PartInstances, {
			...nextPart,
			partId: nextPart._id,
			_id: nextPartInstanceId, // TODO - ensure set correctly
		}))
		// TODO - more async?
		const pieces = Pieces.find({
			rundownId: nextPart.rundownId,
			partId: nextPart._id
		}).fetch()
		_.each(pieces, piece => {
			// Copy each piece into an instance
			ps.push(asyncCollectionInsert(PieceInstances, literal<PieceInstance>({
				...PieceInstanceFromPiece(piece, nextPartInstanceId || ''),
				_id: Random.id(),
			})))
		})

		ps.push(asyncCollectionUpdate(PartInstances, {
			partId: nextPart._id
		}, {
			$set: {
				isReset: true
			}
		}))

		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: {
				nextPartId: nextPart._id,
				nextPartManual: !!setManually,
				nextTimeOffset: nextTimeOffset || null
			}
		}))
		ps.push(asyncCollectionUpdate(PartInstances, nextPartInstanceId, {
			$set: {
				nextTime: getCurrentTime()
			}
		}))
	} else {
		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: {
				nextPartId: null,
				nextPartManual: !!setManually
			}
		}))
	}
	waitForPromiseAll(ps)
	return nextPartInstanceId
}

export function onPartInstanceHasStoppedPlaying (partInstance: PartInstance, stoppedPlayingTime: Time) {
	if (partInstance.startedPlayback && partInstance.startedPlayback > 0) {
		PartInstances.update(partInstance._id, {
			$set: {
				duration: stoppedPlayingTime - partInstance.startedPlayback
			}
		})
		partInstance.duration = stoppedPlayingTime - partInstance.startedPlayback
	} else {
		// logger.warn(`Part "${part._id}" has never started playback on rundown "${rundownId}".`)
	}
}
export function prefixAllObjectIds<T extends TimelineObjGeneric> (objList: T[], prefix: string): T[] {
	const changedIds = objList.map(o => o.id)

	let replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return changedIds.indexOf(id) >= 0 ? '#' + prefix + id : m
		})
	}

	return objList.map(i => {
		const o = clone(i)

		o.id = prefix + o.id

		for (const key of _.keys(o.enable)) {
			if (typeof o.enable[key] === 'string') {
				o.enable[key] = replaceIds(o.enable[key])
			}
		}

		if (typeof o.inGroup === 'string') {
			o.inGroup = changedIds.indexOf(o.inGroup) === -1 ? o.inGroup : prefix + o.inGroup
		}

		return o
	})
}
