import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { applyClassToDocument, registerCollection } from '../lib'
import { Parts } from './Parts'
import { Rundowns } from './Rundowns'
import { FindOptions, MongoSelector, TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import { IBlueprintSegmentDB } from 'tv-automation-sofie-blueprints-integration'
import { PartNote } from '../api/notes'
import { PartInstance, PartInstances } from './PartInstances'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment extends IBlueprintSegmentDB {
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** The rundown this segment belongs to */
	rundownId: string

	status?: string
	expanded?: boolean

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>
}
export class Segment implements DBSegment {
	public _id: string
	public _rank: number
	public externalId: string
	public rundownId: string
	public name: string
	public metaData?: { [key: string]: any }
	public status?: string
	public expanded?: boolean
	public notes?: Array<PartNote>

	constructor (document: DBSegment) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRundown () {
		return Rundowns.findOne(this.rundownId)
	}
	getParts (selector?: MongoSelector<DBSegment>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return Parts.find(
			_.extend({
				rundownId: this.rundownId,
				segmentId: this._id
			}, selector),
			_.extend({
				sort: { _rank: 1 }
			}, options)
		).fetch()
	}
	getPartsOrInstances (): Array<PartInstance> {
		const instances = PartInstances.find({
			rundownId: this.rundownId,
			segmentId: this._id,
			isReset: { $not: { $eq: true } }
		}).fetch()
		const instanceIds = _.map(instances, i => i.partId)

		const parts = Parts.find({
			rundownId: this.rundownId,
			segmentId: this._id,
			_id: { $not: { $in: instanceIds } }
		}).map(part => PartInstance.FromPart(part))

		return _.sortBy(parts.concat(instances), part => part._rank)
	}
	getNotes (includeParts?: boolean, runtimeNotes?: boolean) {
		let notes: Array<PartNote> = []

		if (includeParts) {
			const lines = this.getParts()
			_.each(lines, l => {
				notes = notes.concat(l.getNotes(runtimeNotes))
			})
		}

		notes = notes.concat(this.notes || [])
		return notes
	}
}

// export const Segments = new Mongo.Collection<Segment>('segments', {transform: (doc) => applyClassToDocument(Segment, doc) })
export const Segments: TransformedCollection<Segment, DBSegment>
	= new Mongo.Collection<Segment>('segments', { transform: (doc) => applyClassToDocument(Segment, doc) })
registerCollection('Segments', Segments)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Segments._ensureIndex({
			rundownId: 1,
			_rank: 1
		})
	}
})
