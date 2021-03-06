import * as _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { Studios, Studio } from '../../lib/collections/Studios'
import { ensureCollectionProperty } from './lib'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { protectString } from '../../lib/lib'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "default" migration steps
addMigrationSteps('0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!Studios.findOne()) return 'No Studio found'
			return false
		},
		migrate: () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			Studios.insert({
				_id: protectString('studio0'),
				name: 'Default studio',
				supportedShowStyleBase: [],
				settings: {
					mediaPreviewsUrl: '',
					sofieUrl: ''
				},
				mappings: {},
				config: [],
				_rundownVersionHash: '',
			})
		}
	},
	ensureCollectionProperty('Studios', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	ensureCollectionProperty('Studios', {}, 'mappings', {}),
	ensureCollectionProperty('Studios', {}, 'config', []),

	{
		id: 'Assign devices to studio',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {

			let missing: string | boolean = false
			PeripheralDevices.find({
				parentDeviceId: { $exists: false }
			}).forEach((device) => {
				if (!device.studioId) missing = `PeripheralDevice ${device._id} has no studio`
			})
			return missing
		},
		migrate: () => {
			let studios = Studios.find().fetch()
			if (studios.length === 1) {
				const studio = studios[0]

				let missing: string | boolean = false
				PeripheralDevices.find({
					parentDeviceId: { $exists: false }
				}).forEach((device) => {
					if (!device.studioId) PeripheralDevices.update(device._id, { $set: { studioId: studio._id } })
				})
			} else {
				throw new Error(`Unable to automatically assign Peripheral-devices to a studio, since there are ${studios.length} studios. Please assign them manually`)
			}
		}
	},
	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let studios = Studios.find().fetch()
			let missing: string | boolean = false
			_.each(studios, (studio: Studio) => {
				const dev = PeripheralDevices.findOne({
					type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
					studioId: studio._id
				})
				if (!dev) {
					missing = `Playout-device is missing on ${studio._id}`
				}
			})

			return missing
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Playout-device not set up for all studios',
			description: 'Start up the Playout-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	}
])
