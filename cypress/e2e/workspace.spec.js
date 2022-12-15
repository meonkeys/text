/**
 * @copyright Copyright (c) 2021 Azul <azul@riseup.net>
 *
 * @author Azul <azul@riseup.net>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { randHash } from '../utils/index.js'
const randUser = randHash()

describe('Workspace', function() {
	let currentFolder

	before(function() {
		cy.nextcloudCreateUser(randUser, 'password')
	})

	beforeEach(function() {
		cy.login(randUser, 'password').then(() => {
			// isolate tests - each happens in its own folder
			const retry = cy.state('test').currentRetry()

			currentFolder = retry
				? `${Cypress.currentTest.title} (${retry})`
				: Cypress.currentTest.title
			cy.createFolder(currentFolder)
			cy.visit(`apps/files?dir=/${encodeURIComponent(currentFolder)}`)
		})
	})

	it('Hides the workspace when switching to another folder', function() {
		cy.uploadFile('test.md', 'text/markdown', `${currentFolder}/README.md`)
		cy.createFolder(`${currentFolder}/subdirectory`)
		cy.reload()
		cy.get('.files-fileList').should('contain', 'README.md')
		cy.get('#rich-workspace .ProseMirror')
			.should('contain', 'Hello world')
		cy.openFolder('subdirectory')
		cy.get('#rich-workspace')
			.get('.ProseMirror')
			.should('not.exist')
	})

	it('Hides the workspace when switching to another view', function() {
		cy.uploadFile('test.md', 'text/markdown', `${currentFolder}/README.md`)
		cy.reload()
		cy.get('.files-fileList').should('contain', 'README.md')
		cy.get('#rich-workspace .ProseMirror')
			.should('contain', 'Hello world')
		cy.get('.nav-recent')
			.click()
		cy.get('#rich-workspace .ProseMirror')
			.should('not.visible')
	})

	it('adds a Readme.md', function() {
		const url = '**/remote.php/dav/files/**'
		cy.intercept({ method: 'PUT', url })
			.as('addDescription')

		cy.get('.files-fileList').should('not.contain', 'Readme.md')

		cy.get('.files-controls').within(() => {
			cy.get('.button.new').click()
			cy.get('.newFileMenu a.menuitem[data-action="rich-workspace-init"]').click()
			cy.wait('@addDescription')
		})

		openSidebar('Readme.md')
		cy.get('#rich-workspace .text-editor .text-editor__wrapper')
			.should('be.visible')
	})

	it('formats text', function() {
		cy.openWorkspace()
			.type('Format me', { force: true })
			.type('{selectall}', { force: true })
		;[
			['bold', 'strong'],
			['italic', 'em'],
			['underline', 'u'],
			['strikethrough', 's'],
		].forEach(([button, tag]) => {
			cy.getMenuEntry(button)
				.click({ force: true })
				.should('have.class', 'is-active')
			cy.getContent()
				.find(`${tag}`)
				.should('contain', 'Format me')
			cy.getMenuEntry(button)
				.click({ force: true })
				.should('not.have.class', 'is-active')
		})
	})

	it('creates headings via submenu', function() {
		cy.openWorkspace()
			.type('Heading', { force: true })
			.type('{selectall}', { force: true })
		;['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((heading) => {
			const actionName = `headings-${heading}`

			cy.getSubmenuEntry('headings', actionName).click()

			cy.getContent()
				.find(`${heading}`)
				.should('contain', 'Heading')

			cy.getSubmenuEntry('headings', actionName)
				.should('have.class', 'is-active')
				.click()

			cy.getMenuEntry('headings').should('not.have.class', 'is-active')
		})
	})


	it('creates lists', function() {
		cy.openWorkspace()
			.type('List me', { force: true })
			.type('{selectall}', { force: true })
		;[
			['unordered-list', 'ul'],
			['ordered-list', 'ol'],
			['task-list', 'ul[data-type="taskList"]'],
		].forEach(([button, tag]) => {
			cy.getMenuEntry(button)
				.click({ force: true })
				.should('have.class', 'is-active')

			cy.getContent()
				.find(`${tag}`).should('contain', 'List me')

			cy.getMenuEntry(button)
				.click({ force: true })
				.should('not.have.class', 'is-active')
		})
	})

	it('takes README.md into account', function() {
		cy.uploadFile('test.md', 'text/markdown', `${Cypress.currentTest.title}/README.md`)
		cy.reload()
		cy.get('.files-fileList').should('contain', 'README.md')
		cy.get('#rich-workspace .ProseMirror')
			.should('contain', 'Hello world')
	})

	it('emoji picker', () => {
		cy.openWorkspace()
			.type('# Let\'s smile together{enter}## ', {force: true})

		cy.getMenuEntry('emoji-picker')
			.click()

		cy.get('#emoji-mart-list button[aria-label="😀, grinning"]')
			.first()
			.click({force: true})

		cy.getEditor()
			.find('h2')
			.contains('😀')
	})

	it('relative folder links', () => {
		cy.createFolder(`${currentFolder}/sub-folder`)
		cy.createFolder(`${currentFolder}/sub-folder/alpha`)

		cy.uploadFile('test.md', 'text/markdown', `${currentFolder}/sub-folder/alpha/test.md`)

		cy.openWorkspace()
			.type('link me', { force: true })
			.type('{selectall}', { force: true })

		cy.getSubmenuEntry('insert-link', 'insert-link-file')
			.click()

		cy.get('#picker-filestable tr[data-entryname="sub-folder"]').click()
		cy.get('#picker-filestable tr[data-entryname="alpha"]').click()
		cy.get('#picker-filestable tr[data-entryname="test.md"]').click()
		cy.get('.oc-dialog > .oc-dialog-buttonrow button').click()

		cy.getEditor()
			.find('a')
			.should('have.attr', 'href')
			.and('contains', `dir=/${currentFolder}/sub-folder/alpha`)
			.and('contains', '#relPath=sub-folder/alpha/test.md')

		cy.getEditor()
			.find('a').click()

		cy.getModal()
			.find('.modal-header')
			.contains('test.md')

		cy.getModal()
			.getEditor()
			.contains('Hello world')

		cy.getModal().find('button.header-close').click()
	})

	describe('callouts', () => {
		const types = ['info', 'warn', 'error', 'success']

		before(function() {
			cy.nextcloudCreateUser(randUser, 'password')
		})

		beforeEach(function() {
			cy.openWorkspace().type('Callout', {force: true})
		})
		// eslint-disable-next-line cypress/no-async-tests
		it('create callout', () => {
			cy.wrap(types).each((type) => {
				cy.log(`creating ${type} callout`)

				const actionName = `callout-${type}`

				// enable callout
				cy.getSubmenuEntry('callouts', actionName)
					.click()
					.then(() => {
						// check content
						cy.getContent()
							.find(`.callout.callout--${type}`)
							.should('contain', 'Callout')

						// disable
						return cy.getSubmenuEntry('callouts', actionName)
							.should('have.class', 'is-active')
							.click()
					})
			})
		})

		it('toggle callouts', () => {
			const [first, ...rest] = types

			let last = first

			// enable callout
			cy.getSubmenuEntry('callouts', `callout-${first}`)
				.click()

			cy.wrap(rest)
				.each(type => {
					const actionName = `callout-${type}`
					return cy.getSubmenuEntry('callouts', actionName)
						.click()
						.then(() => cy.getContent().find(`.callout.callout--${type}`))
						.should('contain', 'Callout')
						.then(() => {
							last = type
						})
				})
				.then(() => {
					cy.getSubmenuEntry('callouts', `callout-${last}`)
						.click()

					cy.getMenuEntry('callouts')
						.should('not.have.class', 'is-active')
				})
		})
	})

	describe('localize', () => {
		it('takes localized file name into account', function() {
			cy.nextcloudUpdateUser(randUser, 'password', 'language', 'de_DE')
			cy.uploadFile('test.md', 'text/markdown', `${Cypress.currentTest.title}/Anleitung.md`)
			cy.reload()
			cy.get('.files-fileList').should('contain', 'Anleitung.md')
			cy.get('#rich-workspace .ProseMirror')
				.should('contain', 'Hello world')
		})

		it('ignores localized file name in other language', function() {
			cy.nextcloudUpdateUser(randUser, 'password', 'language', 'fr')
			cy.uploadFile('test.md', 'text/markdown', `${Cypress.currentTest.title}/Anleitung.md`)
			cy.reload()
			cy.get('.files-fileList').should('contain', 'Anleitung.md')
		})
	})

	describe('create Readme.md', () => {
		const checkContent = () => {
			const txt = Cypress.currentTest.title

			cy.getEditor().find('[data-text-el="editor-content-wrapper"]').click({force: true})

			cy.getContent()
				.type(txt, {force: true})
				.should('contain', txt)
		}

		it('click', () => {
			cy.openWorkspace().click({force: true})
			checkContent()
		})

		it('enter', () => {
			cy.openWorkspace().type('{enter}', {force: true})
			checkContent()
		})

		it('spacebar', () => {
			cy.openWorkspace()
				.trigger('keyup', {
					keyCode: 32,
					which: 32,
					shiftKey: false,
					ctrlKey: false,
					force: true,
				})
			checkContent()
		})
	})
})

const openSidebar = filename => {
	cy.get(`.files-fileList tr[data-file="${filename}"]`)
		.should('contain', filename)
	cy.get(`.files-fileList tr[data-file="${filename}"] .icon-more`).click()
	cy.get(`.files-fileList tr[data-file="${filename}"] .icon-details`).click()
	cy.get('.app-sidebar-header').should('contain', filename)
}
