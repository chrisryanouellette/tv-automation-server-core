import { ServerResponse, IncomingMessage } from 'http'
import { Picker, Router, Params } from 'meteor/meteorhacks:picker'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { MeteorMethodSignatures } from '../../methods'
import { PubSub } from '../../../lib/api/pubsub'
import { MeteorPublications, MeteorPublicationSignatures } from '../../publications/lib'
import { UserActionAPIMethods } from '../../../lib/api/userActions'


const POST = Picker.filter((req: IncomingMessage, _res: ServerResponse) => {
	return req.method === 'POST'
})

const GET = Picker.filter((req: IncomingMessage, _res: ServerResponse) => {
	return req.method === 'GET'
})

const apiVersion = 0

const index: any = []

Meteor.startup(() => {
	// Expose all user actions:

	_.each(_.keys(UserActionAPIMethods), (methodName) => {

		const methodValue = UserActionAPIMethods[methodName]
		const signature = MeteorMethodSignatures[methodValue]


		let resource = `/api/${apiVersion}/action/${methodName}`
		let docString = resource
		_.each(signature || [], (paramName, i) => {
			resource += `/:param${i}`
			docString += `/:${paramName}`
		})

		assignRoute('POST', resource, docString, (p) => {
			return Meteor.call(methodValue, ...p)
		})
	})

	// Expose publications:
	_.each(_.keys(PubSub), (pubName) => {

		const pubValue = PubSub[pubName]
		const signature = MeteorPublicationSignatures[pubValue]

		// console.log(pubValue, signature)

		const f = MeteorPublications[pubValue]

		if (f) {
			let resource = `/api/${apiVersion}/publication/${pubName}`
			let docString = resource
			_.each(signature || [], (paramName, i) => {
				resource += `/:param${i}`
				docString += `/:${paramName}`
			})

			assignRoute('GET', resource, docString, (p) => {
				const cursor = f.apply({
					ready: () => null
				}, p)
				if (cursor) return cursor.fetch()
				return []
			})
		}
	})
})

function assignRoute (routeType: 'POST' | 'GET', resource: string, indexResource: string, fcn: (p: any[]) => any) {

	const route: Router = (
		routeType === 'POST' ?
		POST :
		GET
	)

	index.push(routeType + ' ' + indexResource)
	route.route(resource, (params: Params, req: IncomingMessage, res: ServerResponse, next) => {


		let p: any[] = []
		for (let i = 0; i < 20; i++) {
			if (_.has(params, 'param' + i)) {
				p.push(params['param' + i])
			} else {
				break
			}
		}
		try {
			let p: any[] = []
			for (let i = 0; i < 20; i++) {
				if (_.has(params, 'param' + i)) {
					p.push(params['param' + i])
				} else {
					break
				}
			}
			const result = fcn(p)

			res.statusCode = 200
			if (typeof result === 'object') {
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify(result))
			} else {
				res.setHeader('Content-Type', 'text/plain')
				res.end(result)
			}
		} catch (e) {
			if (e.error && e.reason) { // is Meteor.Error
				res.statusCode = e.error
				res.setHeader('Content-Type', 'text/plain')
				res.end(e.reason)
			} else {
				res.statusCode = e.error
				res.setHeader('Content-Type', 'text/plain')
				res.end(e && e.toString())
			}
		}
	})
}

Picker.route('/api', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.statusCode = 301
	res.setHeader('Location', '/api/0') // redirect to latest API version
	res.end()
})
Picker.route('/api/0', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'application/json')
	res.statusCode = 200
	res.end(JSON.stringify(index, undefined, 2))
})
