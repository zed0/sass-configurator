//path to the web worker
var workerPath = 'node_modules/sass.js/dist/sass.worker.js';
//path to the base of where files are available from libsass
var base = '../../../';

var sass;
var editor;
var variables = {};
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

	$('#update_button').on('click', _.debounce(update, 2000, {leading: true, trailing: true}));
	$('#editor_button').on('click', showEditor);
	$('#easy_mode_button').on('click', showEasyMode);
});

function setupWithContent(customizerContent) {
	parseCode(customizerContent);
	editor.getSession().setValue(customizerContent);
	update();
}

function loadFiles(callback) {
	var fullFileList = otherFiles;
	fullFileList.push(baseFile);
	fullFileList.push(customizerFile);
	fullFileList.push(variablesFile);

	sass.preloadFiles(base, '', fullFileList, function() {
		sass.readFile(customizerFile, function(customizerContent) {
			if(customizerContent != '') {
				callback(customizerContent);
			}
			else {
				sass.readFile(variablesFile, function(variablesContent) {
					sass.writeFile(customizerFile, variablesContent, function(success) {
						if(!success)
							throw new Error('could not write ' + customizerFile);
						callback(variablesContent);
					});
				});
			}
		});
	});
}

function update() {
	var code = editor.getSession().getValue();
	if(currentUpdates === 0)
		$('#update_indicator').addClass('fa-spin');
	currentUpdates++;
	sass.writeFile(customizerFile, code, function(success) {
		if(!success) {
			console.error('failed to write ' + customizerFile);
			currentUpdates--;
			if(currentUpdates === 0)
				$('#update_indicator').removeClass('fa-spin');
			return;
		}

		sass.compileFile(baseFile, function(result) {
			if(result.status === 0) {
				window.frames['preview'].contentDocument.getElementById('compiled_sass').innerHTML = result.text;
				postUpdate();
			}
			// TODO: Error highlighting?

			currentUpdates--;
			if(currentUpdates === 0)
				$('#update_indicator').removeClass('fa-spin');
		});
	});
}

function showEditor() {
	$('#easy_mode_container').hide();
	$('#easy_mode_button').removeAttr('disabled');

	$('#editor_container').show();
	$('#editor_button').attr('disabled', true);
	editor.getSession().on('change', _.debounce(update, 2000, {leading: true, trailing: true}));
}

function showEasyMode() {
	$('#editor_container').hide();
	$('#editor_button').removeAttr('disabled');
	editor.getSession().removeAllListeners('change');

	$('#easy_mode_container').show();
	$('#easy_mode_button').attr('disabled', true);
	parseCode(editor.getSession().getValue());
	postUpdate();
}

function parseCode(code) {
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
				modified:  false,
			};

			variables[match[2]] = variable;

			html.push(
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
				'	' + (state.variableComment ? '<span class="help-block">' + state.variableComment + '</span>\n' : '') +
				'</div>\n'
			);
			state.variableComment = null;
		}
	})
	.value();

	$('#easy_mode').html(html.join('\n'));

	_.each(variables, function(variable) {
		$('#' + makeId(variable.name)).val(variable.value);
		$('#' + makeId(variable.name)).change(updateInput);
	});
}

function postUpdate() {
	compileVariables(variables, function(results) {
		_.each(results, function(compiled, name) {
			$('#' + makeId(name) + '-compiled').attr('title', compiled);
			if(isColor(compiled)) {
				var colorPicker = $('#' + makeId(name) + '-color');
				colorPicker.find('.color-swatch').show();
				colorPicker.colorpicker({
					component: '.color-swatch',
					input:     '.color-input',
					align:     'left',
					color:     compiled,
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
	variable.modified = true;

	var codeLines = editor.getSession().getValue().split('\n');
	codeLines[variable.lineNo] = variable.lineStart + variable.value + variable.lineEnd;

	editor.getSession().setValue(codeLines.join('\n'));

	update();
}

function compileVariables(variableList, callback) {
	results = {};
	var variableTest = '';
	variableTest += '@import "custom";\n';
	variableTest += '@import "' + customizerFile + '";\n';
	variableTest += '@import "' + variablesFile + '";\n';
	_.each(variableList, function(variable) {
		variableTest += 'test-properties { test-' + variable.name + ': ' + variable.value + ';}\n';
	});
	sass.compile(variableTest, function(result) {
		if(result.status !== 0) {
			console.error('could not compile variables: ' + result.message);
			return;
		}

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
