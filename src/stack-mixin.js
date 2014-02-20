/**
## Stack Mixin

Stack Mixin is an mixin that provides cross-chart support of stackability using d3.layout.stack.

**/
dc.stackMixin = function (_chart) {

    var _stackLayout = d3.layout.stack()
        .values(dc.pluck('values'));

    var _stack = [];
    var _valueAccessor = _chart.valueAccessor();
    var _titles = {};

    var _hidableStacks = false;

    /**
    #### .stack(group[, name, accessor])
    Stack a new crossfilter group into this chart with optionally a custom value accessor. All stacks in the same chart will
    share the same key accessor therefore share the same set of keys. In more concrete words, imagine in a stacked bar chart
    all bars will be positioned using the same set of keys on the x axis while stacked vertically. If name is specified then
    it will be used to generate legend label.
    ```js
    // stack group using default accessor
    chart.stack(valueSumGroup)
    // stack group using custom accessor
    .stack(avgByDayGroup, function(d){return d.value.avgByDay;});
    ```

    **/
    _chart.stack = function (group, name, accessor) {
        if (!arguments.length) return _stack;

        if (arguments.length <= 2)
            accessor = name;

        var layer = {group: d3.functor(group)};
        if (typeof name === 'string') layer.name = name;
        if (typeof accessor === 'function') layer.accessor = accessor;
        _stack.push(layer);

        return _chart;
    };

    var _stackGroup = {
        all: function() {
            var layers = _stack.filter(visability)
                .map(function(layer) {
                    return layer.group().all();
                });
            var allMap = d3.map();
            var getKey = _chart.keyAccessor();
            layers.forEach(function(layer, i) {
                layer.forEach(function(d) {
                    var key = getKey(d);
                    var v = allMap.get(key);
                    if (!v) {
                        v = [];
                        layers.forEach(function() { v.push(undefined); });  // ensure all layers get some "value" for every key
                        allMap.set(key, v);
                    }
                    v[i] = d;
                });
            });
            return allMap.entries();
        },
        top: function(n) {
            var all = this.all();
            return crossfilter.heapselect.by(function(d) {
                return d3.sum(d.value);
            })(all, 0, all.length, n);
        },
    };

    function stackGroup(g,n,f) {
        if (!arguments.length) return _stackGroup;
        _stack = [];
        _titles = {};
        _chart.stack(stackGroup.overridden, n);
        if (f) _chart.valueAccessor(f);
        return stackGroup.overridden(g,n);
    };
    dc.override(_chart,'group', stackGroup);

    var _stackValueAccessor = function(d) {
        return d3.zip(
            _stack.map(function(layer) {
                return layer.accessor || _valueAccessor;
            }),
            d.value)
            .map(function(args) {
                return args[0](args[1]);
            });
    };

    function stackValueAccessor(f) {
        if (!arguments.length) return _stackValueAccessor;
        _valueAccessor = f;
        return stackValueAccessor.overridden(f);
    }
    dc.override(_chart, 'valueAccessor', stackValueAccessor);

    /**
    #### .hidableStacks([boolean])
    Allow named stacks to be hidden or shown by clicking on legend items.
    This does not affect the behavior of hideStack or showStack.

    **/
    _chart.hidableStacks = function(_) {
        if (!arguments.length) return _hidableStacks;
        _hidableStacks = _;
        return _chart;
    };

    function findLayerByName(n) {
        var i = _stack.map(dc.pluck('name')).indexOf(n);
        return _stack[i];
    }

    /**
    #### .hideStack(name)
    Hide all stacks on the chart with the given name.
    The chart must be re-rendered for this change to appear.

    **/
    _chart.hideStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) layer.hidden = true;
        return _chart;
    };

    /**
    #### .showStack(name)
    Show all stacks on the chart with the given name.
    The chart must be re-rendered for this change to appear.

    **/
    _chart.showStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) layer.hidden = false;
        return _chart;
    };

    _chart.getValueAccessorByIndex = function (index) {
        return _stack[index].accessor || _valueAccessor;
    };

    _chart.yAxisMin = function () {
        var min = d3.min(flattenStack(), function (p) {
            return (p.y + p.y0 < p.y0) ? (p.y + p.y0) : p.y0;
        });

        return dc.utils.subtract(min, _chart.yAxisPadding());

    };

    _chart.yAxisMax = function () {
        var max = d3.max(flattenStack(), function (p) {
            return p.y + p.y0;
        });

        return dc.utils.add(max, _chart.yAxisPadding());
    };

    function flattenStack() {
        return d3.merge(_chart.data().map(dc.pluck('values')));
    }

    _chart.xAxisMin = function () {
        var min = d3.min(flattenStack(), dc.pluck('x'));
        return dc.utils.subtract(min, _chart.xAxisPadding());
    };

    _chart.xAxisMax = function () {
        var max = d3.max(flattenStack(), dc.pluck('x'));
        return dc.utils.add(max, _chart.xAxisPadding());
    };

    /**
    #### .title([stackName], [titleFunction])
    Set or get the title function. Chart class will use this function to render svg title (usually interpreted by browser
    as tooltips) for each child element in the chart, i.e. a slice in a pie chart or a bubble in a bubble chart. Almost
    every chart supports title function however in grid coordinate chart you need to turn off brush in order to use title
    otherwise the brush layer will block tooltip trigger.

    If the first argument is a stack name, the title function will get or set the title for that stack. If stackName
    is not provided, the first stack is implied.
    ```js
    // set a title function on "first stack"
    chart.title("first stack", function(d) { return d.key + ": " + d.value; });
    // get a title function from "second stack"
    var secondTitleFunction = chart.title("second stack");
    );
    ```
    **/
    dc.override(_chart, "title", function (stackName, titleAccessor) {
        if (!stackName) return _chart._title();

        if (typeof stackName === 'function') return _chart._title(stackName);
        if (stackName == _chart._groupName && typeof titleAccessor === 'function')
            return _chart._title(titleAccessor);

        if (typeof titleAccessor !== 'function') return _titles[stackName] || _chart._title();

        _titles[stackName] = titleAccessor;

        return _chart;
    });

    _chart.stackLayout = function (stack) {
        if (!arguments.length) return _stackLayout;
        _stackLayout = stack;
        return _chart;
    };

    function visability(l) {
        return !l.hidden;
    }

    function domainFilter() {
        if (!_chart.x()) return d3.functor(true);
        var xDomain = _chart.x().domain();
        if (_chart.isOrdinal()) {
            // TODO #416
            //var domainSet = d3.set(xDomain);
            return function(p) {
                return true; //domainSet.has(p.x);
            };
        }
        return function(p) {
            //return true;
            return p.x >= xDomain[0] && p.x <= xDomain[xDomain.length-1];
        };
    }

    function stackData(callback) {
        if (arguments.length) return stackData.overridden(callback);
        
        var data = stackData.overridden();
        var getKey = _chart.keyAccessor();
        var getValue = _chart.valueAccessor();
        var limitToDomain = domainFilter();

        // turn multi-valued data into multi-layered single-data
        var layerData = d3.transpose(
            data.map(function(d) {
                var key = getKey(d);
                // pair single values with their key and keep the raw data around for later use
                return getValue(d).map(function(v, i) {
                    return {
                        x: key,
                        y: v,
                        data: d.value[i],
                    };
                })
                .filter(limitToDomain);
            }));
        var layers = layerData.map(function(data, i) {
            return {
                name: String(_stack[i].name || i),
                values: data,
            };
        });
        return layers.length ? _chart.stackLayout()(layers) : [];
    };
    dc.override(_chart, 'data', stackData);

    _chart._ordinalXDomain = function () {
        return flattenStack().map(dc.pluck('x'));
    };

    _chart.colorAccessor(function (d) {
        var layer = this.layer || this.name || d.name || d.layer;
        return layer;
    });

    _chart.legendables = function () {
        return _stack.map(function (layer, i) {
            return {chart:_chart, name:layer.name, hidden: layer.hidden || false, color:_chart.getColor.call(layer,layer.values,i)};
        });
    };

    _chart.isLegendableHidden = function (d) {
        var layer = findLayerByName(d.name);
        return layer ? layer.hidden : false;
    };

    _chart.legendToggle = function (d) {
        if(_hidableStacks) {
            if (_chart.isLegendableHidden(d)) _chart.showStack(d.name);
            else _chart.hideStack(d.name);
            //_chart.redraw();
            dc.renderAll(_chart.chartGroup());
        }
    };

    return _chart;
};
