/**!
 * @file PGMMV Collision Plugin
 * @author Tristan Bonsor <kidthales@agogpixel.com>
 * @copyright 2026 Tristan Bonsor
 * @license {@link https://opensource.org/licenses/MIT MIT License}
 * @version 0.1.0
 */
// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /**
   * @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkPlugin}
   */
  var plugin = {
      setLocale: function () {},
      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV Collision Plugin';
          case 'description':
            return 'Utilities for working with 2D collisions.';
          case 'author':
            return 'Tristan Bonsor <kidthales@agogpixel.com>';
          case 'help':
            return '';
          case 'parameter':
            return [];
          case 'internal':
            return null;
          case 'actionCommand':
            return [];
          case 'linkCondition':
            return [
              onTileWallOrSlopeLinkCondition,
              onSlopeFacingDownslopeLinkCondition,
              onSlopeFacingUpslopeLinkCondition
            ];
          default:
            break;
        }
      },
      initialize: function () {
        if (isEditor()) {
          return;
        }

        if (!window.kt) {
          window.kt = {};
        }

        window.kt.collision = {
          onTileWallOrSlope: onTileWallOrSlope,
          onSlopeFacingDownslope: onSlopeFacingDownslope,
          onSlopeFacingUpslope: onSlopeFacingUpslope
        };
      },
      finalize: function () {},
      setParamValue: function () {},
      setInternal: function () {},
      call: function () {},
      execLinkCondition: function (linkConditionIndex, parameter, objectId, instanceId) {
        /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkLinkCondition} */
        var linkCondition = plugin.getInfo('linkCondition')[linkConditionIndex],
          /** @type {Record<number,import("type-fest").JsonValue>} */
          np = normalizeParameters(parameter, linkCondition.parameter);

        switch (linkCondition.id) {
          case onTileWallOrSlopeLinkCondition.id:
            return onTileWallOrSlope(np[linkCondition.parameter[0].id], np[linkCondition.parameter[1].id], instanceId);
          case onSlopeFacingDownslopeLinkCondition.id:
            return onSlopeFacingDownslope(instanceId);
          case onSlopeFacingUpslopeLinkCondition.id:
            return onSlopeFacingUpslope(instanceId);
          default:
            break;
        }

        return false;
      }
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkLinkCondition} */
    onTileWallOrSlopeLinkCondition = {
      id: 0,
      name: 'On Wall or Slope [PGMMV Collision Plugin]',
      description:
        'Test if object instance bottom wall collision is touching a tile wall or object instance is touching a slope from the top. Leaving the tile group inputs unset will use the default tile group.',
      parameter: [
        {
          id: 100,
          name: 'Tile Group Variable Source:',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Tile Group:',
          type: 'VariableId',
          referenceId: 100,
          withNewButton: true,
          defaultValue: -1
        }
      ]
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkLinkCondition} */
    onSlopeFacingDownslopeLinkCondition = {
      id: 1,
      name: 'On Slope Facing Downslope [PGMMV Collision Plugin]',
      description: 'Test if object instance is touching a slope from the top and facing downslope.',
      parameter: []
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkLinkCondition} */
    onSlopeFacingUpslopeLinkCondition = {
      id: 2,
      name: 'On Slope Facing Upslope [PGMMV Collision Plugin]',
      description: 'Test if object instance is touching a slope from the top and facing upslope.',
      parameter: []
    },
    /**
     * @param variableObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param tileGroupVariableId {number}
     * @param instanceId {number}
     * @returns {boolean}
     */
    onTileWallOrSlope = function (variableObjectId, tileGroupVariableId, instanceId) {
      var tileGroupDefault = Agtk.constants.tileGroup.TileGroupDefault,
        source = resolveSwitchVariableObject(variableObjectId, instanceId),
        /**
         * @type {
         *   import("pgmmv-types/lib/agtk/variables/variable").AgtkVariable |
         *   import("pgmmv-types/lib/agtk/object-instances/object-instance/variables/variable").AgtkVariable
         * }
         */
        tileGroupVariable,
        /** @type {number} */
        tileGroup,
        objectInstance = Agtk.objectInstances.get(instanceId);

      if (source === Agtk.constants.actionCommands.UnsetObject) {
        tileGroup = tileGroupDefault;
      } else if (tileGroupVariableId < 1) {
        tileGroup = tileGroupDefault;
      }

      if (tileGroup === undefined) {
        tileGroupVariable = (
          source === Agtk.constants.switchVariableObjects.ProjectCommon ? Agtk : source
        ).variables.get(tileGroupVariableId);
        tileGroup = !tileGroupVariable ? tileGroupDefault : tileGroupVariable.getValue();
      }

      return (
        objectInstance.isWallTouched({
          wallBit: Agtk.constants.tile.WallBottom,
          useTileGroup: true,
          tileGroup: tileGroup
        }) ||
        objectInstance.isSlopeTouched({
          directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
          downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardNone
        })
      );
    },
    /**
     * @param instanceId {number}
     * @returns {boolean}
     */
    onSlopeFacingDownslope = function (instanceId) {
      var objectInstance = Agtk.objectInstances.get(instanceId),
        direction = objectInstance.variables.get(Agtk.constants.objects.variables.DisplayDirectionId).getValue();

      return (
        (direction === 270 &&
          objectInstance.isSlopeTouched({
            directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
            downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardLeft
          })) ||
        (direction === 90 &&
          objectInstance.isSlopeTouched({
            directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
            downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardRight
          }))
      );
    },
    /**
     * @param instanceId {number}
     * @returns {boolean}
     */
    onSlopeFacingUpslope = function (instanceId) {
      var objectInstance = Agtk.objectInstances.get(instanceId),
        direction = objectInstance.variables.get(Agtk.constants.objects.variables.DisplayDirectionId).getValue();

      return (
        (direction === 270 &&
          objectInstance.isSlopeTouched({
            directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
            downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardRight
          })) ||
        (direction === 90 &&
          objectInstance.isSlopeTouched({
            directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
            downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardLeft
          }))
      );
    },
    /**
     * @returns {boolean}
     */
    isEditor = function () {
      return !Agtk || typeof Agtk.log !== 'function';
    },
    /**
     * @param paramValue {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkParameterValue[]} Parameter values to normalize.
     * @param defaults {import("pgmmv-types/lib/agtk/plugins/plugin/parameter").AgtkParameter[]} Default parameter values available.
     * @returns {Record<number, import("type-fest").JsonValue>}
     */
    normalizeParameters = function (paramValue, defaults) {
      /** @type {Record<number,import("type-fest").JsonValue>} */
      var normalized = {},
        /** @type {number} */
        len = defaults.length,
        /** @type {number} */
        i = 0,
        /** @type {import("pgmmv-types/lib/agtk/plugins/plugin/parameter").AgtkParameter|import("pgmmv-types/lib/agtk/plugins/plugin").AgtkParameterValue} */
        p;

      for (; i < len; ++i) {
        p = defaults[i];
        normalized[p.id] = p.type === 'Json' ? JSON.stringify(p.defaultValue) : p.defaultValue;
      }

      len = paramValue.length;

      for (i = 0; i < len; ++i) {
        p = paramValue[i];
        normalized[p.id] = p.value;
      }

      return normalized;
    },
    /**
     * @param switchVariableObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param instanceId {number}
     * @returns {
     *   import("pgmmv-types/lib/agtk/object-instances/object-instance").AgtkObjectInstance |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/action-commands").AgtkActionCommands['UnsetObject']
     * }
     */
    resolveSwitchVariableObject = function (switchVariableObjectId, instanceId) {
      var instance = Agtk.objectInstances.get(instanceId),
        pId;

      switch (switchVariableObjectId) {
        case Agtk.constants.switchVariableObjects.ProjectCommon:
          return switchVariableObjectId;
        case Agtk.constants.switchVariableObjects.SelfObject:
          return instance;
        case Agtk.constants.switchVariableObjects.ParentObject:
          pId = instance.variables.get(Agtk.constants.objects.variables.ParentObjectInstanceIDId).getValue();

          if (pId !== Agtk.constants.actionCommands.UnsetObject) {
            return Agtk.objectInstances.get(pId);
          }

          break;
        default:
          break;
      }

      return Agtk.constants.actionCommands.UnsetObject;
    };

  return plugin;
})();
