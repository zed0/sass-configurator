var sass;

var workerPath = 'node_modules/sass.js/dist/sass.worker.js';
var base = '../../bootstrap-sass/assets/stylesheets/';

var directory = '';

var files = [
	'_bootstrap.scss',
	'_bootstrap-compass.scss',
	'_bootstrap-mincer.scss',
	'_bootstrap-sprockets.scss',
	'bootstrap/_alerts.scss',
	'bootstrap/_badges.scss',
	'bootstrap/_breadcrumbs.scss',
	'bootstrap/_button-groups.scss',
	'bootstrap/_buttons.scss',
	'bootstrap/_carousel.scss',
	'bootstrap/_close.scss',
	'bootstrap/_code.scss',
	'bootstrap/_component-animations.scss',
	'bootstrap/_dropdowns.scss',
	'bootstrap/_forms.scss',
	'bootstrap/_glyphicons.scss',
	'bootstrap/_grid.scss',
	'bootstrap/_input-groups.scss',
	'bootstrap/_jumbotron.scss',
	'bootstrap/_labels.scss',
	'bootstrap/_list-group.scss',
	'bootstrap/_media.scss',
	'bootstrap/_mixins.scss',
	'bootstrap/_modals.scss',
	'bootstrap/_navbar.scss',
	'bootstrap/_navs.scss',
	'bootstrap/_normalize.scss',
	'bootstrap/_pager.scss',
	'bootstrap/_pagination.scss',
	'bootstrap/_panels.scss',
	'bootstrap/_popovers.scss',
	'bootstrap/_print.scss',
	'bootstrap/_progress-bars.scss',
	'bootstrap/_responsive-embed.scss',
	'bootstrap/_responsive-utilities.scss',
	'bootstrap/_scaffolding.scss',
	'bootstrap/_tables.scss',
	'bootstrap/_theme.scss',
	'bootstrap/_thumbnails.scss',
	'bootstrap/_tooltip.scss',
	'bootstrap/_type.scss',
	'bootstrap/_utilities.scss',
	'bootstrap/_variables.scss',
	'bootstrap/_wells.scss',
	'bootstrap/mixins/_alerts.scss',
	'bootstrap/mixins/_background-variant.scss',
	'bootstrap/mixins/_border-radius.scss',
	'bootstrap/mixins/_buttons.scss',
	'bootstrap/mixins/_center-block.scss',
	'bootstrap/mixins/_clearfix.scss',
	'bootstrap/mixins/_forms.scss',
	'bootstrap/mixins/_gradients.scss',
	'bootstrap/mixins/_grid-framework.scss',
	'bootstrap/mixins/_grid.scss',
	'bootstrap/mixins/_hide-text.scss',
	'bootstrap/mixins/_image.scss',
	'bootstrap/mixins/_labels.scss',
	'bootstrap/mixins/_list-group.scss',
	'bootstrap/mixins/_nav-divider.scss',
	'bootstrap/mixins/_nav-vertical-align.scss',
	'bootstrap/mixins/_opacity.scss',
	'bootstrap/mixins/_pagination.scss',
	'bootstrap/mixins/_panels.scss',
	'bootstrap/mixins/_progress-bar.scss',
	'bootstrap/mixins/_reset-filter.scss',
	'bootstrap/mixins/_reset-text.scss',
	'bootstrap/mixins/_resize.scss',
	'bootstrap/mixins/_responsive-visibility.scss',
	'bootstrap/mixins/_size.scss',
	'bootstrap/mixins/_tab-focus.scss',
	'bootstrap/mixins/_table-row.scss',
	'bootstrap/mixins/_text-emphasis.scss',
	'bootstrap/mixins/_text-overflow.scss',
	'bootstrap/mixins/_vendor-prefixes.scss',
];

var code;

$(document).ready(function() {
	sass = new Sass(workerPath);
	sass.preloadFiles(base, directory, files, function callback() {
		sass.readFile('bootstrap/_variables.scss', function(content) {
			code.getSession().setValue(content);
		});
	});

	code = ace.edit('code');
	code.setTheme('ace/theme/chrome');
	code.getSession().setMode('ace/mode/scss');
	code.getSession().setUseSoftTabs(false);
	code.getSession().setTabSize(2);
	code.getSession().setUseWrapMode(false);
	code.$blockScrolling = Infinity;
	code.getSession().on('change', _.throttle(update, 2000));

	$('#update_button').on('click', _.throttle(update, 2000));
});

function update() {
	var variables = code.getSession().getValue();
	sass.writeFile('bootstrap/_variables.scss', variables, function(success) {
		if(!success) {
			console.err('failed to write bootstrap/_variables.scss');
			return;
		}

		sass.compileFile('_bootstrap.scss', function(result) {
			if(result.status === 0) {
				console.log(result);
				window.frames['preview'].contentDocument.getElementById('compiled_sass').innerHTML = result.text;
			}
			// TODO: Error highlighting?
		});
	});
}
