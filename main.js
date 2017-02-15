//path to the web worker
var workerPath = 'node_modules/sass.js/dist/sass.worker.js';
//path to the base of where files are available from libsass
var base = '../../../';

var sass;
var editor;
var currentSections = [];
var currentUpdates = 0;

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
	sass.options(
		{
			indentedSyntax: false,
			precision: -1,
			style: Sass.style.compact,
			comments: false,
		},
		function() {
			var callback = setupWithContent;
			loadFiles(callback);
		}
	);

	$('#update_button').on('click', _.debounce(compileAll, 2000, {leading: true, trailing: true}));
	$('#editor_button').on('click', showEditor);
	$('#easy_mode_button').on('click', showEasyMode);
});

function setupWithContent(customizerContent, sections) {
	editor.getSession().setValue(customizerContent);
	createEasyMode(sections);
	currentSections = sections;
	compileAll();
}

function loadFiles(callback) {
	var fullFileList = otherFiles;
	fullFileList.push(baseFile);
	fullFileList.push(customizerFile);
	fullFileList.push(variablesFile);

	sass.preloadFiles(base, '', fullFileList, function() {
		sass.readFile(variablesFile, function(variablesContent) {
			var sections = getVariablesFromVariablesFile(variablesContent);

			sass.readFile(customizerFile, function(customizerContent) {
				if(customizerContent != '') {
					updateVariablesFromCustomizerFile(sections, customizerContent);
					callback(customizerContent, sections);
				}
				else {
					customizerContent = sectionsToText(sections);
					sass.writeFile(customizerFile, customizerContent, function(success) {
						if(!success)
							throw new Error('could not write ' + customizerFile);
						updateVariablesFromCustomizerFile(sections, customizerContent);
						callback(customizerContent, sections);
					});
				}
			});
		});
	});
}

function sectionsToText(sections) {
	var text = _(sections)
		.filter(function(section) {
			return section.variables.length
		})
		.map(sectionToText)
		.join('\n');

	return text;
}

function sectionToText(section) {
	var text = '';
	if(section.heading) text += '\n//# ' + section.heading + '\n';
	if(section.description) text += '//## ' + section.description + '\n';
	text += _(section.variables)
		.map(function(variable){return variableToText(variable, true);})
		.join('\n');

	return text;
}

function variableToText(variable, includeComments) {
	var text = '';

	if(variable.comment && includeComments)
		text += '//** ' + variable.comment + '\n';

	text += variable.lineStart;

	if(variable.value)
		text += variable.value;
	else
		text += 'null'

	if(variable.lineEnd)
		text += variable.lineEnd;
	else
		text += '; //Default: ' + variable.defaultValue;

	return text;
}

function startUpdate() {
	if(currentUpdates === 0)
		$('#update_indicator').addClass('fa-spin');
	currentUpdates++;
}

function finishUpdate() {
	currentUpdates--;
	if(currentUpdates === 0)
		$('#update_indicator').removeClass('fa-spin');
}

function compileAll() {
	var code = editor.getSession().getValue();
	startUpdate();
	sass.writeFile(customizerFile, code, function(success) {
		if(!success) {
			finishUpdate();
			throw new Error('failed to write ' + customizerFile);
		}

		sass.compileFile(baseFile, function(result) {
			finishUpdate();
			// TODO: Error highlighting?
			if(result.status !== 0)
				throw new Error('compilation failed!');

			window.frames['preview'].contentDocument.getElementById('compiled_sass').innerHTML = result.text;
			postUpdate();
		});
	});
}

function showEditor() {
	$('#easy_mode_container').hide();
	$('#easy_mode_button').removeAttr('disabled');

	$('#editor_container').show();
	$('#editor_button').attr('disabled', true);
	editor.resize();
	editor.getSession().on('change', _.debounce(compileAll, 2000, {leading: true, trailing: true}));
}

function showEasyMode() {
	$('#editor_container').hide();
	$('#editor_button').removeAttr('disabled');
	editor.getSession().removeAllListeners('change');

	$('#easy_mode_container').show();
	$('#easy_mode_button').attr('disabled', true);
	updateVariablesFromCustomizerFile(currentSections, editor.getSession().getValue());

	_.each(getVariables(currentSections), function(variable) {
		$('#' + makeId(variable.name)).val(variable.value || variable.defaultValue);
	})
}

function updateVariablesFromCustomizerFile(sections, text) {
	var variables = getVariables(sections);

	_(text)
	.split('\n')
	.each(function(line, lineNo) {
		var match;
		if(match = line.match(/^(\$([^:]+):(\s*))([^;]*)(;.*)$/)) {
			var name = match[2];
			var currentVariable = _.find(variables, function(variable){
				return variable.name === name;
			});

			if(!currentVariable)
				return;

			currentVariable.customLineNo = lineNo;
			currentVariable.lineEnd      = match[5];

			if(match[4] == 'null')
				return;

			currentVariable.value        = match[4];
			currentVariable.modified     = true;
		}
	})
	.value();
}

function getVariablesFromVariablesFile(text) {
	var defaultSection = {
		heading:     'Misc',
		description: null,
		variables:   [],
	};

	var state = {
		ignoring: false,
		variableComment: null,
		section: null,
	};

	var sections = [_.cloneDeep(defaultSection)];

	_(text)
	.split('\n')
	.each(function(line, lineNo) {
		var match;
		if(match = line.match(/^\/\/== (.*$)/)) {
			var section = _.cloneDeep(defaultSection);
			section.heading = match[1];
			sections.push(section);
			state.ignoring = false;
		}
		else if(state.ignoring) {
			return;
		}
		//TODO
		/*
		else if(match = line.match(/^\/\/=== (.*$)/)) {
			//html.push(marked('## ' + match[1]));
		}
		*/
		else if(match = line.match(/^\/\/## (.*$)/)) {
			_.last(sections).description = match[1];
		}
		else if(match = line.match(/^\/\/\*\* (.*$)/)) {
			state.variableComment = match[1];
		}
		else if(match = line.match(/^(\$([^:]+):(\s*))([^;]*) !default;/)) {
			var variable = {
				variableLineNo: lineNo,
				customLineNo:   undefined,
				lineStart:      match[1],
				name:           match[2],
				spacing:        match[3],
				defaultValue:   match[4],
				lineEnd:        undefined,
				modified:       false,
				section:        _.last(sections).heading,
				comment:        state.variableComment,
				value:          undefined,
			};

			_.last(sections).variables.push(variable);

			state.variableComment = null;
		}
	})
	.value();

	return sections;
}

function createEasyMode(sections) {
	var html = sectionsToHtml(sections);

	$('#easy_mode').html(html);

	_.each(getVariables(sections), function(variable) {
		$('#' + makeId(variable.name)).val(variable.value || variable.defaultValue);
		$('#' + makeId(variable.name)).change(updateInput);
	})
}

function getVariables(sections) {
	return _(sections)
		.map('variables')
		.flatten()
		.value();
}

function getVariable(sections, name) {
	return _.find(getVariables(sections), function(variable) {
		return variable.name === name;
	});
}

function sectionsToHtml(sections) {
	return _(sections)
		.map(sectionToHtml)
		.join('\n');
}

function sectionToHtml(section) {
	var html = '';
	if(section.variables.length) {
		if(section.heading)     html += marked('# ' + section.heading);
		if(section.description) html += marked(section.description);
		html += _(section.variables)
			.map(variableToHtml)
			.join('\n');
	}
	return html;
}

function variableToHtml(variable) {
	var text =
		'<div class="form-group">\n' +
		'	<label for="' + makeId(variable.name) + '" class="control-label">\n' +
		'		$' + variable.name + '\n' +
		'	</label>\n' +
		'	<div id="' + makeId(variable.name) + '-color" class="input-group colorpicker-component" data-varname="' + variable.name + '">' +
		'		<span class="input-group-addon" id="' + makeId(variable.name) + '-compiled">' +
		'			<span class="fa fa-eye"></span>' +
		'		</span>' +
		'		<span class="input-group-addon color-swatch" style="display: none;">' +
		'			<i></i>' +
		'		</span>' +
		'		<input type="hidden" id="' + makeId(variable.name) + '-color-input" class="color-input">\n' +
		'		<input id="' + makeId(variable.name) + '" data-varname="' + variable.name + '" type="text" class="form-control">\n' +
		'	</div>' +
		'	' + (variable.comment ? '<span class="help-block">' + marked(variable.comment) + '</span>\n' : '') +
		'</div>\n';
	return text;
}

function postUpdate() {
	var addInputs = function(compiled, name) {
		$('#' + makeId(name) + '-compiled').attr('title', compiled);

		if(isColor(compiled))
			createSwatch(name, compiled);
	};

	var createSwatch = function(name, color) {
		var colorPicker = $('#' + makeId(name) + '-color');
		colorPicker.find('.color-swatch').show();
		colorPicker.colorpicker({
			component: '.color-swatch',
			input:     '.color-input',
			align:     'left',
			color:     color,
		})
		.on('changeColor', updateColor);
	};

	compileVariables(getVariables(currentSections), function(results) {
		_.each(results, addInputs);
	});
}

function makeId(variableName) {
	return 'var-' + variableName;
}

function updateColor(e) {
	var value = e.color.toString('hex');
	var variable = getVariable(currentSections, $(e.target).data('varname'));
	$('#' + makeId(variable.name)).val(value);
	modifyVariable(value, variable);
}

function updateInput() {
	var value = $(this).val();
	var variable = getVariable(currentSections, $(this).data('varname'));
	var colorPicker = $('#' + makeId(variable.name) + '-color');
	// We temporarily remove the handler so that updateColor doesn't get fired
	colorPicker.off('changeColor');
	colorPicker.colorpicker('setValue', value);
	colorPicker.on('changeColor', updateColor);
	modifyVariable(value, variable);
}

function _modifyVariable(value, variable) {
	variable.value = value;
	variable.modified = true;

	var codeLines = editor.getSession().getValue().split('\n');
	codeLines[variable.customLineNo] = variableToText(variable, false);
	editor.getSession().setValue(codeLines.join('\n'));

	compileAll();
}

function compileVariables(variableList, callback) {
	results = {};
	var variableTest = '';
	variableTest += '@import "custom";\n';
	variableTest += '@import "' + customizerFile + '";\n';
	variableTest += '@import "' + variablesFile + '";\n';
	_.each(variableList, function(variable) {
		variableTest += 'test-properties { test-' + variable.name + ': $' + variable.name + ';}\n';
	});
	sass.compile(variableTest, function(result) {
		if(result.status !== 0)
			throw new Error('could not compile variables: ' + result.message);

		_.each(variableList, function(variable) {
			var matches = result.text.match(new RegExp('test-' + variable.name + ': (.*);'));
			results[variable.name] = matches[1];
		});
		callback(results);
	})
}

function isColor(value) {
	if(value === '')
		return false;
	if(value === 'inherit')
		return false;
	if(value === 'transparent')
		return false;
	if(!isNaN(value))
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
