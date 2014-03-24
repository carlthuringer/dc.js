/**
## Stack Mixin

Stack Mixin is an mixin that provides cross-chart support of stackability using d3.layout.stack.

**/
dc.stackMixin = function (_chart) {

    var _stackLayout = d3.layout.stack()
        .values(dc.pluck('values'));

    var _stack = [];
    var _titles = {};
    var _stacked = true;
    var _fullStackData = false;
    var _stackedColor = true;

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
        if (_stack.length > 1) {
            _stackedColor = true;
        }

        return _chart;
    };

    function layerName(i) {
        return String(_stack[i].name || i);
    }

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
                        v = { key: key, value: [] };
                        layers.forEach(function() { v.value.push(undefined); });  // ensure all layers get some "value" for every key
                        allMap.set(key, v);
                    }
                    v.value[i] = d;
                });
            });
            return allMap.values();
        },
        top: function(n) {
            var all = this.all();
            var getVal = _chart.valueAccessor();
            return crossfilter.heapselect.by(function(d) {
                return d3.sum(getVal(d));
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
        if (d.value.length) {  // if an array value
            return d3.zip(
                _stack.map(function(layer) {
                    return layer.accessor || stackValueAccessor.overridden();
                }),
                d.value)
                .map(function(args) {
                    return args[0](args[1]);
                });
        }
        // simple case where the stack has already been removed
        // FIXME doesn't work for higher stacks as the context has been lost
        return stackValueAccessor.overridden()(d);
    };

    function stackValueAccessor(f) {
        if (!arguments.length) return _stackValueAccessor;
        return stackValueAccessor.overridden(f);
    }
    dc.override(_chart, 'valueAccessor', stackValueAccessor);

    var _stackDataAccessor = function(d) {
        return d.value.map(stackDataAccessor.overridden());
    };
    function stackDataAccessor(f) {
        if (!arguments.length) return _stackDataAccessor;
        return stackDataAccessor.overridden(f);
    }
    dc.override(_chart, '_dataAccessor', stackDataAccessor);

    var _stackClientDataAccessor = function(d) {
        if (_fullStackData) {
            return _stackDataAccessor(d);
        }
        return stackClientDataAccessor.overridden()(d.value[0]);
    };
    function stackClientDataAccessor(f) {
        if (!arguments.length) return _stackClientDataAccessor;
        return stackClientDataAccessor.overridden(f);
    }
    dc.override(_chart, '_clientDataAccessor', stackClientDataAccessor);

    /**
    #### .fullStackData(fullStackData)
    Whether to provide all the stacks data to client functions such as
    title, ordering, etc.  This is provided as an array of data in the
    same order as the stacks were created.  Defaults to returning just
    the first stack's data as a simple object.
    
    **/
    _chart.fullStackData = function(_) {
        if (!arguments.length) return _fullStackData;
        _fullStackData = _;
        return _chart;
    };

    var _stackApply = function(f,d) {
        // this needs to create something which can be accessed though dataAccessor
        return {
            value: d3.transpose(d)
                .map(function(layer) {
                    return stackApply.overridden()(f, layer);
                }),
        };
    };
    function stackApply(f) {
        if (!arguments.length) return _stackApply;
        return stackApply.overridden(f);
    }
    dc.override(_chart, '_apply', stackApply);

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
            return _chart._y(p);
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
                // pair single values with their key and keep the (enhanced) raw data around for later use
                return getValue(d).map(function(v, i) {
                    var data = Object.create(d);
                    data.layer = layerName(i);
                    return {
                        x: key,
                        y: v,
                        data: data,
                    };
                })
                .filter(limitToDomain);
            }));
        var layers = layerData.map(function(data, i) {
            return {
                name: layerName(i),
                values: data,
            };
        });
        return layers.length ? _chart.stackLayout()(layers) : [];
    };
    dc.override(_chart, 'data', stackData);

    _chart._ordinalXDomain = function () {
        return flattenStack().map(dc.pluck('x'));
    };

    _chart._stackedColor = function(_) {
        if (!arguments.length) return _stackedColor;
        _stackedColor = _;
        return _chart;
    };

    function stackColorAccessor(d, i) {
        if (!arguments.length) return stackColorAccessor;
        if (_stackedColor) {
            var layer = this.layer || this.name || d.name || d.layer;
            return layer;
        } else {
            return stackColorAccessor.overridden()(d, i);
        }
    };

    dc.override(_chart,'colorAccessor', stackColorAccessor);

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

    /**
    #### .stacked(stacked)
    Whether this is a stacked line or an overlayed line chart.  Defaults to true (stacked).

    **/
    _chart.stacked = function(_) {
        if (!arguments.length) return _stacked;
        _stacked = _;
        return _chart;
    };
        
    _chart._y = function(d) {
        return _stacked ? d.y + d.y0 : d.y;
    }

    return _chart;
};
