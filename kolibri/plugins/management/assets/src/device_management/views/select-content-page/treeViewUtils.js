import find from 'lodash/find';
import flip from 'lodash/flip';
import sumBy from 'lodash/fp/sumBy';
import { createTranslator } from 'kolibri.utils.i18n';
import { updateTopicLinkObject } from '../../wizardTransitionRoutes';

const translator = createTranslator('treeViewRowMessages', {
  alreadyOnYourDevice: 'Already on your device',
  fractionOfResourcesOnDevice:
    '{onDevice, number, useGrouping} of {total, number, useGrouping} resources on your device',
  resourcesSelected:
    '{total, number, useGrouping} {total, plural, one {resource} other {resources}} selected',
  fractionOfResourcesSelected:
    '{selected, number, useGrouping} of {total, number, useGrouping} {total, plural, one {resource} other {resources}} selected',
  noTitle: 'No title',
});

export const CheckboxTypes = {
  CHECKED: 'checked',
  UNCHECKED: 'unchecked',
  INDETERMINATE: 'indeterminate',
};

// One-liner utilities for annotateNode
// isAncestorOf(a, b) is truthy if a is an ancestor of b
const isAncestorOf = (a, b) => find(b.path, { pk: a.pk });
const isDescedantOf = flip(isAncestorOf);
const sumTotalResources = sumBy('total_resources');
const sumOnDeviceResources = sumBy('on_device_resources');

/**
 * Takes a Node, plus contextual data from store, then annotates them with info
 * needed to correctly display it on tree view.
 *
 * @param node {Node}
 * @param selectedNodes {SelectedNodes}
 * @param selectedNodes.omitted {Array<Node>}
 * @param selectedNodes.included {Array<Node>}
 * @returns {AnnotatedNode} - annotations are message, disabled, and checkboxType
 *
 */
export function annotateNode(node, selectedNodes) {
  const { on_device_resources, total_resources } = node;
  const isIncluded = find(selectedNodes.included, { pk: node.pk });
  const isOmitted = find(selectedNodes.omitted, { pk: node.pk });
  const ancestorIsIncluded = find(selectedNodes.included, iNode => isAncestorOf(iNode, node));
  const ancestorIsOmitted = find(selectedNodes.omitted, oNode => isAncestorOf(oNode, node));

  // Completely on device -> DISABLED
  if (on_device_resources === total_resources) {
    return {
      ...node,
      message: translator.$tr('alreadyOnYourDevice'),
      disabled: true,
      checkboxType: CheckboxTypes.CHECKED,
    };
  }

  if (!(isOmitted || ancestorIsOmitted) && (isIncluded || ancestorIsIncluded)) {
    const omittedDescendants = selectedNodes.omitted.filter(oNode => isDescedantOf(oNode, node));

    // If any descendants are omitted -> UNCHECKED or INDETERMINATE
    if (omittedDescendants.length > 0) {
      const omittedResources =
        (sumTotalResources(omittedDescendants) || 0) -
        (sumOnDeviceResources(omittedDescendants) || 0);

      // All descendants are omitted -> UNCHECKED
      if (omittedResources === total_resources - on_device_resources) {
        return {
          ...node,
          message: '',
          disabled: false,
          checkboxType: CheckboxTypes.UNCHECKED,
        };
      }

      // Some (but not all) descendants are omitted -> INDETERMINATE
      return {
        ...node,
        message: translator.$tr('fractionOfResourcesSelected', {
          selected: total_resources - sumTotalResources(omittedDescendants),
          total: total_resources,
        }),
        disabled: false,
        checkboxType: CheckboxTypes.INDETERMINATE,
      };
    }

    // Completely selected -> CHECKED
    return {
      ...node,
      message: translator.$tr('resourcesSelected', { total: total_resources }),
      disabled: false,
      checkboxType: CheckboxTypes.CHECKED,
    };
  }

  const fullyIncludedDescendants = selectedNodes.included
    .filter(iNode => isDescedantOf(iNode, node))
    .filter(iNode => !selectedNodes.omitted.find(oNode => isDescedantOf(oNode, iNode)));

  if (fullyIncludedDescendants.length > 0) {
    const fullIncludedDescendantsResources =
      sumTotalResources(fullyIncludedDescendants) - sumOnDeviceResources(fullyIncludedDescendants);

    // Node is not selected, has all children selected -> CHECKED
    if (fullIncludedDescendantsResources === total_resources - on_device_resources) {
      return {
        ...node,
        message: translator.$tr('resourcesSelected', { total: total_resources }),
        disabled: false,
        checkboxType: CheckboxTypes.CHECKED,
      };
    }

    // Node is not selected, has some children selected -> INDETERMINATE
    return {
      ...node,
      message: translator.$tr('fractionOfResourcesSelected', {
        selected: fullIncludedDescendantsResources,
        total: total_resources,
      }),
      disabled: false,
      checkboxType: CheckboxTypes.INDETERMINATE,
    };
  }

  if (on_device_resources > 0) {
    // Node has some (but not all) resources on device -> UNCHECKED (w/ message).
    // Node with all resources on device handled at top of this function.
    return {
      ...node,
      message: translator.$tr('fractionOfResourcesOnDevice', {
        onDevice: on_device_resources,
        total: total_resources,
      }),
      disabled: false,
      checkboxType: CheckboxTypes.UNCHECKED,
    };
  }

  // Node is not selected, has no children, is not on device -> UNCHECKED
  return {
    ...node,
    message: '',
    disabled: false,
    checkboxType: CheckboxTypes.UNCHECKED,
  };
}

/**
 * Takes an array of breadcrumb { id, title } objects in state, and converts them
 * into a form that can be used in k-breadcrumbs props.items { text, link: LinkObject }.
 *
 */
export function transformBreadrumb(node) {
  return {
    text: node.title || translator.$tr('noTitle'),
    link: updateTopicLinkObject(node),
  };
}
