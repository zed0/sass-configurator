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

var editor;
var variables = {};

var modifyVariable = _.debounce(_modifyVariable, 2000, {leading: true, trailing: true});

$(document).ready(function() {
	editor = ace.edit('editor');
	editor.setTheme('ace/theme/chrome');
	editor.getSession().setMode('ace/mode/scss');
	editor.getSession().setUseSoftTabs(false);
	editor.getSession().setTabSize(2);
	editor.getSession().setUseWrapMode(false);
	editor.$blockScrolling = Infinity;

	sass = new Sass(workerPath);
	sass.options({indentedSyntax: false});
	sass.preloadFiles(base, directory, files, function callback() {
		sass.readFile('bootstrap/_variables.scss', function(content) {
			editor.getSession().setValue(content);
			update();
			parseCode();
			editor.getSession().on('change', _.throttle(update, 2000));
		});
	});

	$('#update_button').on('click', _.throttle(update, 2000));
	$('#editor_button').on('click', showEditor);
	$('#easy_mode_button').on('click', showEasyMode);
});

function update(input) {
	var code = editor.getSession().getValue();
	sass.writeFile('bootstrap/_variables.scss', code, function(success) {
		if(!success) {
			console.error('failed to write bootstrap/_variables.scss');
			return;
		}

		sass.compileFile('_bootstrap.scss', function(result) {
			if(result.status === 0) {
				window.frames['preview'].contentDocument.getElementById('compiled_sass').innerHTML = result.text;
				postUpdate();
			}
			// TODO: Error highlighting?
		});
	});
}

function showEditor() {
	$('#easy_mode_container').hide();
	$('#easy_mode_button').removeAttr('disabled');
	$('#editor_container').show();
	$('#editor_button').attr('disabled', true);
}

function showEasyMode() {
	$('#editor_container').hide();
	$('#editor_button').removeAttr('disabled');
	$('#easy_mode_container').show();
	$('#easy_mode_button').attr('disabled', true);
	parseCode();
	postUpdate();
}

function parseCode() {
	var code = editor.getSession().getValue();

	var state = {
		ignoring: false,
		variableComment: null,
	};

	var html = [];
	_(code)
	.split('\n')
	.each(function(line, lineNo) {
		var match;
		if(match = line.match(/^\/\/== (.*$)/)) {
			state.ignoring = false;
			html.push(marked('# ' + match[1]));
		}
		else if(state.ignoring) {
			return;
		}
		else if(match = line.match(/^\/\/=== (.*$)/)) {
			html.push(marked('## ' + match[1]));
		}
		else if(match = line.match(/^\/\/## (.*$)/)) {
			html.push(marked(match[1]));
		}
		else if(match = line.match(/^\/\/\*\* (.*$)/)) {
			state.variableComment = marked(match[1]);
		}
		else if(match = line.match(/^(\$([^:]+):(\s*))([^;]*)( !default;)/)) {
			var variable = {
				lineNo:    lineNo,
				lineStart: match[1],
				name:      match[2],
				spacing:   match[3],
				value:     match[4],
				lineEnd:   match[5],
			};

			variables[match[2]] = variable;

			html.push(
				'<div class="form-group">\n' +
				'	<label for="' + makeId(variable.name) + '" class="control-label">\n' +
				'		$' + variable.name + '\n' +
				'	</label>\n' +
				'	<div id="' + makeId(variable.name) + '-color" class="input-group colorpicker-component" data-varname="' + variable.name + '">' +
				'		<span class="input-group-addon" id="' + makeId(variable.name) + '-compiled">' +
				'			<span class="fa fa-magic"></span>' +
				'		</span>' +
				'		<span class="input-group-addon color-swatch" style="display: none;">' +
				'			<i></i>' +
				'		</span>' +
				'		<input type="hidden" id="' + makeId(variable.name) + '-color-input" class="color-input">\n' +
				'		<input id="' + makeId(variable.name) + '" value="' + variable.value + '" data-varname="' + variable.name + '" type="text" class="form-control">\n' +
				'	</div>' +
				'	' + (state.variableComment ? '<span class="help-block">' + state.variableComment + '</span>\n' : '') +
				'</div>\n'
			);
			state.variableComment = null;
		}
	})
	.value();

	$('#easy_mode').html(html.join('\n'));

	_.each(variables, function(variable) {
		$('#' + makeId(variable.name)).change(updateInput);
	});
}

function postUpdate() {
	_.each(variables, function(variable) {
		compileVariable(variable.value, variable.name, function(result) {
			$('#' + makeId(variable.name) + '-compiled').attr('title', result);
			if(isColor(result)) {
				var colorPicker = $('#' + makeId(variable.name) + '-color');
				colorPicker.find('.color-swatch').show();
				colorPicker.colorpicker({
					component: '.color-swatch',
					input:     '.color-input',
					align:     'left',
					color:     result,
				})
				.on('changeColor', updateColor);
			}
		});
	});
}

function makeId(variableName) {
	return 'var-' + variableName;
}

function updateColor(e) {
	var value = e.color.toString('hex');
	var variable = variables[$(e.target).data('varname')];
	$('#' + makeId(variable.name)).val(value);
	modifyVariable(value, variable);
}

function updateInput() {
	var value = $(this).val();
	var variable = variables[$(this).data('varname')];
	modifyVariable(value, variable);
}

function _modifyVariable(value, variable) {
	variable.value = value;

	var codeLines = editor.getSession().getValue().split('\n');
	codeLines[variable.lineNo] = variable.lineStart + variable.value + variable.lineEnd;

	editor.getSession().setValue(codeLines.join('\n'));

	update();
}

function compileVariable(value, name, callback) {
	var variableTest = '@import "bootstrap/variables"; test-element{test-property: ' + value + ';}';
	sass.compile(variableTest, function(result) {
		if(result.status !== 0) {
			console.error('could not compile variable: ' + result.message);
			return;
		}

		var matches = result.text.match(/test-property: (.*);/);
		callback(matches[1]);
	});
}

function isColor(value) {
	if(value === '')
		return false;
	if(value === 'inherit')
		return false;
	if(value === 'transparent')
		return false;

	var elem = document.createElement('span');

	elem.style.color = 'rgb(0, 0, 0)';
	elem.style.color = value;

	if(elem.style.color !== 'rgb(0, 0, 0)')
		return true;

	elem.style.color = 'rgb(255, 255, 255)';
	elem.style.color = value;

	if(elem.style.color !== 'rgb(255, 255, 255)')
		return true;

	return false;
}
