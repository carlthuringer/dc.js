/**
## Row Chart

Includes: [Cap Mixin](#cap-mixin), [Margin Mixin](#margin-mixin), [Color Mixin](#color-mixin), [Base Mixin](#base-mixin)

Concrete row chart implementation.

#### dc.rowChart(parent[, chartGroup])
Create a row chart instance and attach it to the given parent element.

Parameters:

* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed in a certain chart group then any interaction with such instance will only trigger events and redraw within the same chart group.

Return a newly created row chart instance

```js
// create a row chart under #chart-container1 element using the default global chart group
var chart1 = dc.rowChart("#chart-container1");
// create a row chart under #chart-container2 element using chart group A
var chart2 = dc.rowChart("#chart-container2", "chartGroupA");
```

**/
dc.rowChart = function (parent, chartGroup) {

    var _g;

    var _labelOffsetX = 10;
    var _labelOffsetY = 15;
    var _titleLabelOffsetX = 2;

    var _gap = 5;

    var _rowCssClass = "row";
    var _titleRowCssClass = "titlerow";
    var _renderTitleLabel = false;

    var _chart = dc.capMixin(dc.stackMixin(dc.marginMixin(dc.colorMixin(dc.baseMixin({})))));
    _chart._stackedColor(false);  // default to a single group with a color range

    var _x;

    var _elasticX;

    var _integerX = false;

    var _xAxis = d3.svg.axis().orient("bottom");

    _chart.rowsCap = _chart.cap;

    _chart.yAxisPadding = function() { return 0; };  // FIXME pretend to be coordinate-grid-ish for _chart.yAxisMax() call below

    function calculateAxisScale() {
        if (!_x || _elasticX) {
            var xMax = _chart.yAxisMax();  // it's lying on it's side  :-)
            _x = d3.scale.linear().domain([0, xMax])
                .range([0, _chart.effectiveWidth()]);
	    var xWidth = Math.abs(xMax);
            _xAxis.ticks(_integerX && xWidth < 10 ? xWidth : 10);
        }
        _xAxis.scale(_x);
    }

    function drawAxis() {
        var axisG = _g.select("g.axis");

        calculateAxisScale();

        if (axisG.empty())
            axisG = _g.append("g").attr("class", "axis")
                .attr("transform", "translate(0, " + _chart.effectiveHeight() + ")");

        dc.transition(axisG, _chart.transitionDuration())
            .call(_xAxis);
    }

    _chart._doRender = function () {
        _chart.resetSvg();

        _g = _chart.svg()
            .append("g")
            .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");

        _gridSection = _g.append('g');

        drawChart();

        return _chart;
    };

    _chart.title(function (d) {
        return d.x + ": " + d.y;
    });

    var bindKey = dc.pluck('x');

    _chart.label(bindKey);

    _chart.x = function(x){
        if(!arguments.length) return _x;
        _x = x;
        return _chart;
    };

    var _gridSection;

    function drawGridLines() {
        var gridLines = _gridSection.selectAll(".grid-line")
            .data(_x.ticks(_xAxis.ticks()[0]));
        gridLines.enter()
            .append("line")
                .attr("class", "grid-line")
                .attr("x1", _chart.effectiveWidth())
                .attr("x2", _chart.effectiveWidth())
                .attr("y1", 0)
                .attr("y2", function () {
                    return _chart.effectiveHeight();
                });
        gridLines
            .transition()
            .duration(_chart.transitionDuration())
            .attr("x1", _x)
            .attr("x2", _x);
        gridLines.exit()
            .remove()
    }

    function drawChart() {
	var data = _chart.data();
        var layers = _g.selectAll("g.stack")
            .data(data);

        calculateAxisScale();
        drawGridLines();

        layers
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "stack " + "_" + i;
            });

        layers.each(function (layer, i) {
            var rows = d3.select(this).selectAll("g." + _rowCssClass)
		.data(layer.values, bindKey);

            createElements(layer, rows);
            removeElements(layer, rows);
            updateElements(layer, rows);
	});
    }

    function createElements(layer, rows) {
        var rowEnter = rows.enter()
            .append("g")
            .attr("class", function (d, i) {
                return _rowCssClass + " _" + i;
            });

        rowEnter.append("rect")
            .attr("width", 0)
            .attr("fill", function(d) { return _chart.getColor(d.data); });

        createLabels(rowEnter);
        updateLabels(rows);
    }

    function removeElements(layer, rows) {
        rows.exit().remove();
    }

    function updateElements(layer, rows) {
        var n = rows.data().length;

        var height = (_chart.effectiveHeight() - (n + 1) * _gap) / n;

        var rect = rows.attr("transform",function (d, i) {
                return "translate(0," + ((i + 1) * _gap + i * height) + ")";
            }).select("rect")
            .attr("height", height)
            .on("click", onClick)
            .classed("deselected", function (d) {
                return (_chart.hasFilter()) ? !isSelectedRow(d) : false;
            })
            .classed("selected", function (d) {
                return (_chart.hasFilter()) ? isSelectedRow(d) : false;
            });

        dc.transition(rect, _chart.transitionDuration())
	    .attr("x", function(d) { return _x(d.y0); })
            .attr("width", function (d) {
                var start = _x(0) == -Infinity ? _x(1) : _x(0);
                return Math.abs(start - _x(d.y));
            });

        createTitles(rows);
        updateLabels(rows);
    }

    function createTitles(rows) {
        if (_chart.renderTitle()) {
            rows.selectAll("title").remove();
            rows.append("title").text(function(d) {
                return _chart.title(d.name)(_chart._clientDataAccessor()(d.data));
            });
        }
    }

    function createLabels(rowEnter) {
        if (_chart.renderLabel()) {
            rowEnter.append("text")
                .on("click", onClick);
        }
        if (_chart.renderTitleLabel()) {
            rowEnter.append("text")
                .attr("class", _titleRowCssClass)
                .on("click", onClick);
        }
    }

    function updateLabels(rows) {
        if (_chart.renderLabel()) {
            var lab = rows.select("text")
                .attr("x", _labelOffsetX)
                .attr("y", _labelOffsetY)
                .on("click", onClick)
                .attr("class", function (d, i) {
                    return _rowCssClass + " _" + i;
                })
                .text(function (d) {
                    return _chart.label()(d);
                });
        }
        if (_chart.renderTitleLabel()) {
            var titlelab = rows.select("." + _titleRowCssClass)
                    .attr("x", _chart.effectiveWidth() - _titleLabelOffsetX)
                    .attr("y", _labelOffsetY)
                    .attr("text-anchor", "end")
                    .on("click", onClick)
                    .attr("class", function (d, i) {
                        return _titleRowCssClass + " _" + i ;
                    })
                    .text(function (d) {
                        return _chart.title()(d);
                    });
        }
    }

    /**
    #### .renderTitleLabel(boolean)
    Turn on/off Title label rendering (values) using SVG style of text-anchor 'end'

    **/
    _chart.renderTitleLabel = function (_) {
        if (!arguments.length) return _renderTitleLabel;
        _renderTitleLabel = _;
        return _chart;
    };

    function onClick(d) {
        _chart.onClick(d.data);
    }

    _chart._doRedraw = function () {
        drawChart();
        return _chart;
    };

    _chart.xAxis = function () {
        return _xAxis;
    };

    /**
    #### .gap([gap])
    Get or set the vertical gap space between rows on a particular row chart instance. Default gap is 5px;

    **/
    _chart.gap = function (g) {
        if (!arguments.length) return _gap;
        _gap = g;
        return _chart;
    };

    /**
    #### .elasticX([boolean])
    Get or set the elasticity on x axis. If this attribute is set to true, then the x axis will rescle to auto-fit the data
    range when filtered.

    **/
    _chart.elasticX = function (_) {
        if (!arguments.length) return _elasticX;
        _elasticX = _;
        return _chart;
    };

    /**
    #### .labelOffsetX([x])
    Get or set the x offset (horizontal space to the top left corner of a row) for labels on a particular row chart. Default x offset is 10px;

    **/
    _chart.labelOffsetX = function (o) {
        if (!arguments.length) return _labelOffsetX;
        _labelOffsetX = o;
        return _chart;
    };

    /**
    #### .labelOffsetY([y])
    Get or set the y offset (vertical space to the top left corner of a row) for labels on a particular row chart. Default y offset is 15px;

    **/
    _chart.labelOffsetY = function (o) {
        if (!arguments.length) return _labelOffsetY;
        _labelOffsetY = o;
        return _chart;
    };

    /**
    #### .titleLabelOffsetx([x])
    Get of set the x offset (horizontal space between right edge of row and right edge or text.   Default x offset is 2px;

    **/
    _chart.titleLabelOffsetX = function (o) {
        if (!arguments.length) return _titleLabelOffsetX;
        _titleLabelOffsetX = o;
        return _chart;
    };

    _chart.integerX = function (o) {
	if (!arguments.length) return _integerX;
	_integerX = o;
	return _chart;
    };

    function isSelectedRow (d) {
        return _chart.hasFilter(d.x);
    }

    _chart.isOrdinal = function() {
	return true;
    };

    return _chart.anchor(parent, chartGroup);
};
