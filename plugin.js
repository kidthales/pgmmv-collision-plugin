// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /**
   * @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkPlugin}
   */
  var plugin = {
      setLocale: function (locale) {},

      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV Plugin Template';
          case 'description':
            return 'PGMMV Plugin Template';
          case 'author':
            return 'Author Name';
          case 'help':
            return 'Plugin Help';
          case 'parameter':
            return [];
          case 'internal':
            return {};
          case 'actionCommand':
            return [];
          case 'linkCondition':
            return [];
          default:
            break;
        }
      },

      initialize: function (data) {
        if (isEditor()) {
          return;
        }

        Agtk.log('Initialize ' + plugin.getInfo('name'));
      },

      finalize: function () {},

      setParamValue: function (paramValue) {
        if (isEditor()) {
          return;
        }

        for (var i = 0; i < paramValue.length; ++i) {
          Agtk.log('Parameter ' + paramValue[i].id + ' = ' + paramValue[i].value);
        }
      },

      setInternal: function (data) {},

      call: function () {},

      update: function (delta) {},

      execActionCommand: function (
        actionCommandIndex,
        parameter,
        objectId,
        instanceId,
        actionId,
        commandId,
        commonActionStatus,
        sceneId
      ) {},

      execLinkCondition: function (
        linkConditionIndex,
        parameter,
        objectId,
        instanceId,
        actionLinkId,
        commonActionStatus
      ) {}
    },
    /**
     * @returns {boolean}
     */
    isEditor = function () {
      return !Agtk || typeof Agtk.log !== 'function';
    };

  return plugin;
})();
